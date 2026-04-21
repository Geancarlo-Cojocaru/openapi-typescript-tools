/**
 * AST parsing utilities for extracting endpoint definitions from custom-paths.ts.
 * Reads the TypeScript source, locates the `definition` object, and collects
 * endpoint metadata (routes, methods, schemas, parameters).
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * Create a TypeScript SourceFile from disk.
 * @param {string} filePath - Absolute path to a TS file.
 * @returns {import('typescript').SourceFile}
 */
export const readSource = (filePath) => ts.createSourceFile(filePath, fs.readFileSync(filePath, 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

/**
 * Get text of a TS node using a specific SourceFile as context.
 * @param {import('typescript').Node} node
 * @param {import('typescript').SourceFile} sf
 * @returns {string}
 */
const getText = (node, sf) => node.getText(sf);

/**
 * Extract the first type argument text from a call expression, if present.
 * @param {import('typescript').CallExpression} callExpr
 * @param {import('typescript').SourceFile} sf
 * @returns {string | null}
 */
const extractTypeArgText = (callExpr, sf) => {
  if (!callExpr.typeArguments || callExpr.typeArguments.length === 0) return null;
  return getText(callExpr.typeArguments[0], sf);
};

/**
 * Locate and return the `definition` object literal from custom-paths.ts.
 * The initializer may be wrapped in parenthesized/satisfies/as-expressions; unwrap to reach the ObjectLiteralExpression.
 * @param {import('typescript').SourceFile} sf
 * @returns {import('typescript').ObjectLiteralExpression}
 * @throws When the `definition` variable is not found or not an object literal.
 */
const extractDefinition = (sf) => {
  let defObj = null;

  const unwrapToObjectLiteral = (init) => {
    if (!init) return null;
    // Walk through layers like satisfies/as/paren to reach the object literal
    let node = init;
    // Unwrap parentheses
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    // Unwrap satisfies
    if (ts.isSatisfiesExpression?.(node)) node = node.expression;
    // Unwrap as const / as Type
    while (ts.isAsExpression(node)) node = node.expression;
    return ts.isObjectLiteralExpression(node) ? node : null;
  };

  sf.forEachChild((node) => {
    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((decl) => {
        if (ts.isIdentifier(decl.name) && decl.name.text === 'definition' && decl.initializer) {
          const ol = unwrapToObjectLiteral(decl.initializer);
          if (ol) defObj = ol;
        }
      });
    }
  });
  if (!defObj) throw new Error('Could not find exported const definition in custom-paths.ts');
  return defObj;
};

/**
 * Extract path parameter names from a route like "/users/{id}/orders/{orderId}" -> ["id", "orderId"].
 * @param {string} route
 * @returns {string[]}
 */
const pathParamsFromPath = (route) => {
  const params = [];
  const regex = /\{([^}]+)}/g;
  let m;
  while ((m = regex.exec(route)) !== null) {
    params.push(m[1]);
  }
  return params;
};

/**
 * Convert human/path strings into PascalCase words (preserving path param names),
 * used for building deterministic type aliases.
 * Example: "/user/{userId}" + "Ok" -> "GeneratedUserUserIdOk"
 * @param {string} str
 * @returns {string}
 */
const toPascalCase = (str) => {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ') // non-alnum to space
    .replace(/\{([^}]+)}/g, ' $1 ') // keep path params as words
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
};

/**
 * Build a Generated* alias name from a route and suffix label.
 * @param {string} route
 * @param {string} suffix - e.g., "Ok", "Err", "Query"
 * @returns {string}
 */
const makeGeneratedAlias = (route, suffix) => {
  const base = toPascalCase(route);
  const suf = toPascalCase(suffix);
  return `Generated${base}${suf}`;
};

/**
 * Walk the `definition` object and collect endpoint metadata and referenced type aliases.
 * Supports two shapes:
 *  - Legacy: { method, queryParams?, body?, okResponse?, errorResponse? }
 *  - Multi-method: { get?: { ... }, post?: { ... }, ... }
 * For each route/method, it extracts response schemas (ok/error) with statuses and media types,
 * query params schema, and optional request body schema.
 * Also infers path params from the route path.
 * @param {import('typescript').SourceFile} sf
 * @param {function(string, string|null): string|null} registerSchema - Callback to register a schema alias
 * @returns {Array<{route:string, method:string, ok?:{schemaAlias:string, status:number, mediaType:string}|null, errors:Array<{schemaAlias:string, status:number, mediaType:string}>, querySchemaAlias:string|null, body?:{schemaAlias:string, mediaType:string}|null, pathParams:string[]}>}
 */
export const collectEndpoints = (sf, registerSchema) => {
  const defObj = extractDefinition(sf);
  const endpoints = [];

  const DEFAULT_OK_STATUS = 200;
  const DEFAULT_ERR_STATUS = 400;
  const DEFAULT_MEDIA = 'application/json';
  const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);

  /**
   * Parse a method definition object literal and push an endpoint entry
   */
  const parseMethodObject = (route, method, objExpr, sf) => {
    const methodSuffix = toPascalCase(method);
    /** @type {{schemaAlias:string, status:number, mediaType:string}|null} */
    let ok = null;
    /** @type {Array<{schemaAlias:string, status:number, mediaType:string}>} */
    const errors = [];
    let querySchemaAlias = null;
    /** @type {{schemaAlias:string, mediaType:string}|null} */
    let body = null;

    objExpr.properties.forEach((p) => {
      if (!ts.isPropertyAssignment(p)) return;
      const name = p.name.getText(sf).replace(/['"]/g, '');

      if (name === 'queryParams' && ts.isObjectLiteralExpression(p.initializer)) {
        let schemaCall = null;
        p.initializer.properties.forEach((sp) => {
          if (!ts.isPropertyAssignment(sp)) return;
          const sn = sp.name.getText(sf).replace(/['"]/g, '');
          if (sn === 'schema' && ts.isCallExpression(sp.initializer)) schemaCall = sp.initializer;
        });
        if (schemaCall) {
          const typeText = extractTypeArgText(schemaCall, sf);
          const alias = makeGeneratedAlias(route, `${methodSuffix}Query`);
          registerSchema(alias, typeText);
          querySchemaAlias = alias;
        }
        return;
      }

      if (name === 'body' && ts.isObjectLiteralExpression(p.initializer)) {
        let schemaCall = null;
        let mediaTypeNode = null;
        p.initializer.properties.forEach((sp) => {
          if (!ts.isPropertyAssignment(sp)) return;
          const sn = sp.name.getText(sf).replace(/['"]/g, '');
          if (sn === 'schema' && ts.isCallExpression(sp.initializer)) schemaCall = sp.initializer;
          if (sn === 'mediaType') mediaTypeNode = sp.initializer;
        });
        if (schemaCall) {
          const typeText = extractTypeArgText(schemaCall, sf);
          const alias = makeGeneratedAlias(route, `${methodSuffix}Body`);
          registerSchema(alias, typeText);
          const mediaType = (mediaTypeNode && ts.isStringLiteral(mediaTypeNode)) ? mediaTypeNode.text : DEFAULT_MEDIA;
          body = { schemaAlias: alias, mediaType };
        }
        return;
      }

      if (name === 'okResponse') {
        if (ts.isObjectLiteralExpression(p.initializer)) {
          let schemaCall = null;
          let statusNode = null;
          let mediaTypeNode = null;
          p.initializer.properties.forEach((sp) => {
            if (!ts.isPropertyAssignment(sp)) return;
            const sn = sp.name.getText(sf).replace(/['"]/g, '');
            if (sn === 'schema' && ts.isCallExpression(sp.initializer)) schemaCall = sp.initializer;
            if (sn === 'status') statusNode = sp.initializer;
            if (sn === 'mediaType') mediaTypeNode = sp.initializer;
          });
          if (schemaCall) {
            const typeText = extractTypeArgText(schemaCall, sf);
            const alias = makeGeneratedAlias(route, `${methodSuffix}Ok`);
            registerSchema(alias, typeText);
            const status = (statusNode && ts.isNumericLiteral(statusNode)) ? Number(statusNode.text) : DEFAULT_OK_STATUS;
            const mediaType = (mediaTypeNode && ts.isStringLiteral(mediaTypeNode)) ? mediaTypeNode.text : DEFAULT_MEDIA;
            ok = { schemaAlias: alias, status, mediaType };
          }
        }
        return;
      }

      if (name === 'errorResponse') {
        const handleErrObj = (obj, indexHint) => {
          let schemaCall = null;
          let statusNode = null;
          let mediaTypeNode = null;
          obj.properties.forEach((sp) => {
            if (!ts.isPropertyAssignment(sp)) return;
            const sn = sp.name.getText(sf).replace(/['"]/g, '');
            if (sn === 'schema' && ts.isCallExpression(sp.initializer)) schemaCall = sp.initializer;
            if (sn === 'status') statusNode = sp.initializer;
            if (sn === 'mediaType') mediaTypeNode = sp.initializer;
          });
          if (schemaCall) {
            const typeText = extractTypeArgText(schemaCall, sf);
            let suffix = 'Err';
            if (statusNode && ts.isNumericLiteral(statusNode)) suffix = `${methodSuffix}Err${statusNode.text}`; else if (typeof indexHint === 'number') suffix = `${methodSuffix}Err${indexHint}`; else suffix = `${methodSuffix}Err`;
            const alias = makeGeneratedAlias(route, suffix);
            registerSchema(alias, typeText);
            const status = (statusNode && ts.isNumericLiteral(statusNode)) ? Number(statusNode.text) : DEFAULT_ERR_STATUS;
            const mediaType = (mediaTypeNode && ts.isStringLiteral(mediaTypeNode)) ? mediaTypeNode.text : DEFAULT_MEDIA;
            errors.push({ schemaAlias: alias, status, mediaType });
          }
        };

        const init = p.initializer;
        if (ts.isObjectLiteralExpression(init)) {
          handleErrObj(init);
        } else if (ts.isArrayLiteralExpression?.(init)) {
          init.elements.forEach((el, idx) => {
            if (ts.isObjectLiteralExpression(el)) handleErrObj(el, idx);
          });
        }
      }
    });

    const pathParams = pathParamsFromPath(route);
    endpoints.push({ route, method, ok, errors, querySchemaAlias, body, pathParams });
  };

  defObj.properties.forEach((prop) => {
    if (!ts.isPropertyAssignment(prop)) return;
    const key = ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (!key) return;
    const route = key;
    const value = prop.initializer;
    if (!ts.isObjectLiteralExpression(value)) return;

    // Expect a multi-method shape (has HTTP method keys)
    const methodProps = value.properties.filter((p) => ts.isPropertyAssignment(p) && HTTP_METHODS.has(p.name.getText(sf).replace(/['"]/g, '')));
    if (methodProps.length > 0) {
      methodProps.forEach((mp) => {
        if (!ts.isPropertyAssignment(mp)) return;
        const methodName = mp.name.getText(sf).replace(/['"]/g, '');
        const init = mp.initializer;
        if (ts.isObjectLiteralExpression(init)) parseMethodObject(route, methodName, init, sf);
      });
      return;
    }

    // No HTTP method keys found: enforce new shape only
    throw new Error(`Path '${route}' must use multi-method shape with HTTP method keys (e.g., get, post).`);
  });

  return endpoints;
};

/**
 * Extract import declarations from the definition source file and collect
 * a mapping of imported symbol names to their resolved absolute file paths.
 * @param {import('typescript').SourceFile} sf
 * @param {string} defFile - Absolute path to the definition file.
 * @returns {Map<string, string>} symbol name -> absolute path of the source module
 */
export const collectDefinitionImports = (sf, defFile) => {
  const importMap = new Map();
  const defDir = path.dirname(defFile);
  sf.forEachChild((node) => {
    if (!ts.isImportDeclaration(node)) return;
    const moduleSpec = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpec)) return;
    const modulePath = moduleSpec.text;
    // Only handle relative imports (named schema files)
    if (!modulePath.startsWith('.')) return;
    const resolved = path.resolve(defDir, modulePath);
    const clause = node.importClause;
    if (!clause) return;
    // Named imports: import { Foo, Bar } from '...'
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      clause.namedBindings.elements.forEach((el) => {
        importMap.set(el.name.text, resolved);
      });
    }
    // Default import: import Foo from '...'
    if (clause.name) {
      importMap.set(clause.name.text, resolved);
    }
  });
  return importMap;
};
