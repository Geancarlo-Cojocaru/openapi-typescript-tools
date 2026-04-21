/**
 * Schema generation and normalization utilities.
 * Manages a registry of type aliases, generates JSON Schemas via ts-json-schema-generator,
 * and normalizes them for OpenAPI compatibility.
 */
import fs from 'fs';
import path from 'path';
import { createGenerator } from 'ts-json-schema-generator';
import { collectDefinitionImports } from './parse-definitions.mjs';

/**
 * Registry of type aliases to generate JSON Schemas for.
 * Key: generated alias name, Value: type expression string (may be inline or a symbol from D=custom-paths.ts)
 * @type {Map<string, string>}
 */
const schemaRegistry = new Map(); // alias -> typeExpr

/**
 * Set of named (non-inline) type symbols referenced in schema<T>() calls.
 * Used to collect imports that need to be replicated in the temp file.
 * @type {Set<string>}
 */
const referencedSymbols = new Set();

/**
 * Decide whether a type expression is inline (object/array/union/utility) or references a named symbol.
 * Inline expressions are emitted directly; otherwise we qualify with the D. namespace.
 * @param {string} text
 * @returns {boolean}
 */
const isInlineTypeExpr = (text) => {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[') || t.includes('|') || t.startsWith('Partial<') || t.startsWith('Pick<') || t.startsWith('Record<') || t.startsWith('Array<');
};

/**
 * Register a schema alias mapped to a type expression; de-duplicates by alias.
 * @param {string} alias
 * @param {string | null} typeExpr - Inline type expression or a symbol from the imported definitions
 * @returns {string | null} The alias when registered, else null when no type expression provided.
 */
export const registerSchema = (alias, typeExpr) => {
  if (!typeExpr) return null;
  if (!schemaRegistry.has(alias)) schemaRegistry.set(alias, typeExpr);
  // Track named symbols so we can replicate their imports in the temp file
  if (!isInlineTypeExpr(typeExpr)) referencedSymbols.add(typeExpr.trim());
  return alias;
};

/**
 * Clear the schema registry and referenced symbols (useful for testing or re-runs).
 */
export const clearRegistry = () => {
  schemaRegistry.clear();
  referencedSymbols.clear();
};

/**
 * Create a temporary TS file exporting our generated aliases pointing to either inline expressions
 * or to the imported types from custom-paths.ts. This makes ts-json-schema-generator's job trivial.
 * @param {import('typescript').SourceFile} sf
 * @param {string} defFile - Absolute path to the definition file.
 * @param {string} tmpDir - Absolute path to the temp directory.
 * @param {string} tmpFile - Absolute path to the temp file.
 */
export const prepareTempSchemasFile = (sf, defFile, tmpDir, tmpFile) => {
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // Collect imports from the definition file so we can resolve named type references
  const defImports = collectDefinitionImports(sf, defFile);

  const lines = [
    '// Auto-generated ephemeral aliases for ts-json-schema-generator',
  ];

  // For each referenced named symbol, add an import from its original source
  // Group symbols by their source module for cleaner output
  /** @type {Map<string, string[]>} resolved path -> symbol names */
  const importsByModule = new Map();
  for (const sym of referencedSymbols) {
    const absPath = defImports.get(sym);
    if (absPath) {
      if (!importsByModule.has(absPath)) importsByModule.set(absPath, []);
      importsByModule.get(absPath).push(sym);
    } else {
      console.warn(`Warning: referenced symbol '${sym}' not found in definition file imports. It may fail to resolve.`);
    }
  }
  for (const [absPath, symbols] of importsByModule.entries()) {
    let rel = path.relative(tmpDir, absPath).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    lines.push(`import type { ${symbols.join(', ')} } from '${rel}';`);
  }

  for (const [alias, typeExpr] of schemaRegistry.entries()) {
    // Use the type expression directly — inline types work as-is,
    // and named symbols are now properly imported above
    lines.push(`export type ${alias} = ${typeExpr};`);
  }
  fs.writeFileSync(tmpFile, lines.join('\n') + '\n', 'utf8');
};

/**
 * Generate a JSON Schema for a previously registered alias using ts-json-schema-generator.
 * @param {string} alias
 * @param {string} tmpFile - Absolute path to the temp file.
 * @param {string} tsconfigPath - Absolute path to tsconfig.json.
 * @returns {Record<string, any>} The schema for the alias (root or extracted from definitions)
 */
const generateJsonSchemaForAlias = (alias, tmpFile, tsconfigPath) => {
  const config = {
    path: tmpFile,
    tsconfig: tsconfigPath,
    type: alias,
    expose: 'all',
    topRef: false,
    skipTypeCheck: true,
    ref: false,
  };
  const generator = createGenerator(config);
  // Return full schema including its internal definitions so we can dereference them later
  return generator.createSchema(alias);
};

/**
 * Normalize JSON Schemas coming from ts-json-schema-generator so they are valid OpenAPI component schemas.
 * - Dereference local $ref like { $ref: "#/definitions/X", definitions: { X: {...} } }
 * - Drop stray `definitions` objects (OpenAPI components.schemas shouldn't embed them)
 * @param {Record<string, any>} sch
 * @returns {Record<string, any>}
 */
const normalizeSchema = (sch) => {
  if (!sch || typeof sch !== 'object') return sch;

  // Clone to avoid mutating original
  const clone = (obj) => (Array.isArray(obj) ? obj.map((v) => (typeof v === 'object' && v ? clone(v) : v)) : { ...obj });

  const defs = sch.definitions || {};

  const deref = (node) => {
    if (!node || typeof node !== 'object') return node;

    // Resolve local definition refs
    if (typeof node.$ref === 'string') {
      const m = node.$ref.match(/^#\/definitions\/(.+)$/);
      if (m) {
        const defName = m[1];
        const target = defs[defName];
        if (target) {
          // Replace the ref node with a deep clone of the target, then continue processing
          return deref(clone(target));
        }
      }
    }

    // Traverse common schema constructs
    if (node.properties && typeof node.properties === 'object') {
      for (const key of Object.keys(node.properties)) {
        node.properties[key] = deref(node.properties[key]);
      }
    }
    if (node.items) {
      node.items = deref(node.items);
    }
    if (node.additionalProperties && typeof node.additionalProperties === 'object') {
      node.additionalProperties = deref(node.additionalProperties);
    }
    if (Array.isArray(node.allOf)) node.allOf = node.allOf.map(deref);
    if (Array.isArray(node.anyOf)) node.anyOf = node.anyOf.map(deref);
    if (Array.isArray(node.oneOf)) node.oneOf = node.oneOf.map(deref);
    if (node.not) node.not = deref(node.not);
    if (node.if) node.if = deref(node.if);
    if (node.then) node.then = deref(node.then);
    if (node.else) node.else = deref(node.else);
    if (node.definitions && typeof node.definitions === 'object') {
      // Avoid carrying nested definitions into OAS components
      delete node.definitions;
    }
    if (node.patternProperties && typeof node.patternProperties === 'object') {
      for (const key of Object.keys(node.patternProperties)) {
        node.patternProperties[key] = deref(node.patternProperties[key]);
      }
    }

    return node;
  };

  const out = deref(clone(sch));
  // Ensure no top-level definitions in components
  if (out.definitions) delete out.definitions;
  return out;
};

/**
 * Build the components.schemas object by generating and normalizing a schema for each registered alias.
 * @param {string} tmpFile - Absolute path to the temp file.
 * @param {string} tsconfigPath - Absolute path to tsconfig.json.
 * @returns {Record<string, any>} components.schemas mapping (alias -> schema)
 */
export const buildComponentsSchemas = (tmpFile, tsconfigPath) => {
  const components = {};
  for (const [alias] of schemaRegistry.entries()) {
    const jsonSchema = generateJsonSchemaForAlias(alias, tmpFile, tsconfigPath);
    components[alias] = normalizeSchema(jsonSchema);
  }
  return components;
};
