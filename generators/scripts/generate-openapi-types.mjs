import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { pathToFileURL } from 'url';
import openapiTS, { astToString } from 'openapi-typescript';
import { getProjectRoot, getFileDir } from './paths.mjs';
import { ensureDirectoryExistence, formatOutput, capitalize } from './utils.mjs';
import { generatorConfig } from '../../config.mjs';

/** Resolve paths to root */
const openapiRootDir = getProjectRoot(getFileDir(import.meta.url));

/**
 * Resolve string inputs (URLs or local paths) to a URL instance that openapi-typescript accepts.
 */
const resolveToURL = (input) => {
  if (typeof input !== 'string') return input;
  const lower = input.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return new URL(input);
  }
  const abs = path.isAbsolute(input) ? input : path.resolve(openapiRootDir, input);
  return pathToFileURL(abs);
};

/**
 * Helper transform types (used in the transform function for path parameters).
 */
const STRING = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('string'));
const NULL = ts.factory.createLiteralTypeNode(ts.factory.createNull());
const BLOB = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('Blob'));
const NUMBER = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('number'));


/**
 * Generates the OpenAPI schema and writes it to a file.
 * See documentation for openapi-ts here: https://openapi-ts.dev/node
 *
 * Transformations:
 * - Convert all path parameters to strings, as they should always be strings
 */
export const getOpenApiSchema = async () => {
  console.log('Generating API endpoints types from schema(s)...');

  const generatedDir = path.resolve(getFileDir(import.meta.url), '..', '..', 'generated-types');

  for (const { outputName, jsonSchemaURL, basicAuth, pathFilter } of generatorConfig) {
    const outputPath = path.resolve(generatedDir, outputName);
    console.log(`- Processing: ${jsonSchemaURL} -> ${outputPath}`);
    try {
      let schemaSource = resolveToURL(jsonSchemaURL);

      // If basicAuth is provided, pre-fetch the schema with auth headers and pass the parsed JSON directly
      if (basicAuth) {
        const authHeader = `Basic ${Buffer.from(`${basicAuth.username}:${basicAuth.password}`).toString('base64')}`;
        const response = await fetch(jsonSchemaURL, { headers: { Authorization: authHeader } });
        if (!response.ok) {
          throw new Error(`Failed to load ${jsonSchemaURL}: ${response.status} ${response.statusText}`);
        }
        schemaSource = await response.json();
      }

      // If pathFilter is provided, keep only paths that start with one of the given prefixes
      // and prune components/schemas to only those actually referenced by the kept paths.
      if (pathFilter && pathFilter.length > 0 && schemaSource && typeof schemaSource === 'object') {
        const filteredPaths = Object.fromEntries(
          Object.entries(schemaSource.paths ?? {}).filter(([p]) =>
            pathFilter.some((prefix) => p.startsWith(prefix)),
          ),
        );

        // Recursively collect all $ref strings from an object
        const collectRefs = (node, refs = new Set()) => {
          if (!node || typeof node !== 'object') return refs;
          if (Array.isArray(node)) {
            node.forEach((item) => collectRefs(item, refs));
          } else {
            for (const [key, value] of Object.entries(node)) {
              if (key === '$ref' && typeof value === 'string') {
                refs.add(value);
              } else {
                collectRefs(value, refs);
              }
            }
          }
          return refs;
        };

        // Resolve refs transitively: keep expanding until no new refs are found
        const allRefs = collectRefs(filteredPaths);
        const components = schemaSource.components ?? {};
        const schemas = components.schemas ?? {};
        let changed = true;
        while (changed) {
          changed = false;
          for (const ref of [...allRefs]) {
            // $ref format: #/components/schemas/SchemaName
            const match = ref.match(/^#\/components\/schemas\/(.+)$/);
            if (match) {
              const schemaName = match[1];
              if (schemas[schemaName]) {
                const nested = collectRefs(schemas[schemaName]);
                for (const nestedRef of nested) {
                  if (!allRefs.has(nestedRef)) {
                    allRefs.add(nestedRef);
                    changed = true;
                  }
                }
              }
            }
          }
        }

        // Build the set of schema names to keep
        const keepSchemas = new Set(
          [...allRefs]
            .map((ref) => ref.match(/^#\/components\/schemas\/(.+)$/)?.[1])
            .filter(Boolean),
        );

        schemaSource = {
          ...schemaSource,
          paths: filteredPaths,
          components: {
            ...components,
            schemas: Object.fromEntries(
              Object.entries(schemas).filter(([name]) => keepSchemas.has(name)),
            ),
          },
        };
      }

      // Options descriptions are here: https://openapi-ts.dev/cli#flags
      const ast = await openapiTS(schemaSource, {
        transform(schemaObject, metadata) {
          // Schema objects don't have a path property, so we need to use the metadata.path to identify them.
          // Metadata.path includes api path, schema path, etc. so always use it to identify the right object.
          // So we will use this to extract the path parameters and convert them to strings.
          if (metadata?.path?.includes('parameters/path')) {
            if (schemaObject?.type === 'integer') {
              return schemaObject.nullable
                ? ts.factory.createUnionTypeNode([STRING, NULL])
                : STRING;
            }
          }

          // Transform binary formats to Blob (instead of string)
          if (schemaObject?.format === 'binary') {
            return {
              schema: BLOB,
              questionToken: true,
            };
          }

          // Transform floats to the number type
          if (schemaObject?.format === 'float' || schemaObject?.type === 'float') {
            return NUMBER;
          }
        },
      });

      // Convert the AST to a string and remove comments.
      const contents = astToString(ast, {
        formatOptions: {
          removeComments: true,
        },
      });

      // Add a comment at the top of the file.
      // We disable the naming-convention rule because the OpenAPI schema uses snake_case.
      // It's better to keep the same naming convention as the schema to avoid confusion.
      const comment = '/* eslint-disable  @typescript-eslint/naming-convention */\n// This file was generated by the script \'generate-openapi-types.mjs\'. Don\'t modify it manually!\n\n';
      const finalContents = formatOutput(comment + contents);

      // Ensure that the directory for the output file exists
      ensureDirectoryExistence(outputPath);

      // Write the output to the JSON file
      fs.writeFileSync(outputPath, finalContents);
      console.log(`  ✔ Wrote: ${outputPath}`);
    } catch (err) {
      console.error(`  ✖ Failed for ${jsonSchemaURL}:`, err?.message || err);
    }
  }

  // Auto-generate index.ts that merges all generated schema files
  generateIndexFile(generatedDir);

  console.log('API endpoints types generation done!');
};

/**
 * Generates the `index.ts` barrel file that imports all generated schema files
 * and progressively merges their paths, components, webhooks, operations, and $defs
 * using MergePreferLeft to avoid type conflicts.
 *
 * The merge order follows the generatorConfig array order (first entry wins on conflicts).
 *
 * @param {string} generatedDir - Absolute path to the generated-types directory.
 */
const generateIndexFile = (generatedDir) => {
  const n = generatorConfig.length;
  if (n === 0) {
    console.log('  ⚠ No entries in generatorConfig, skipping index.ts generation.');
    return;
  }

  const lines = [];
  lines.push('// This file was auto-generated by generate-openapi-types.mjs. Don\'t modify it manually!');
  lines.push('// EsLint disable reason: We want to keep the original naming from the OpenAPI spec for clarity and consistency.');
  lines.push('');

  // Import lines
  for (let i = 0; i < n; i++) {
    const moduleName = generatorConfig[i].outputName.replace(/\.ts$/, '');
    lines.push(`import type * as S${i} from './${moduleName}';`);
  }
  lines.push('');

  // Helper types (only needed when merging multiple schemas)
  if (n > 1) {
    lines.push('/**');
    lines.push(' * Merges two types, preferring the left type in case of key conflicts.');
    lines.push(' * This is useful for merging OpenAPI components where the left schema should take precedence.');
    lines.push(' */');
    lines.push('type MergePreferLeft<L, R> = L & Omit<R, keyof L>;');
    lines.push('');
    lines.push('/** Extracts the \'schemas\' property from a type if it exists, otherwise returns an empty object. */');
    lines.push('type GetSchemas<T> = T extends { schemas: infer S } ? S : {};');
    lines.push('');
    lines.push('/** Adds the \'schemas\' property to a base type if the schemas type is not empty. */');
    lines.push('type WithSchemas<Base, Schemas> = Omit<Base, \'schemas\'> & (Schemas extends {} ? { schemas: Schemas } : {});');
    lines.push('');
    lines.push('/** Merges two OpenAPI components or $defs, preferring the left type in case of key conflicts. */');
    lines.push('type MergeComponentsPreferLeft<L, R> = WithSchemas<MergePreferLeft<L, R>, MergePreferLeft<GetSchemas<L>, GetSchemas<R>>>;');
    lines.push('');
  }

  // Categories to merge
  const categories = [
    { name: 'components', mergeType: 'MergeComponentsPreferLeft' },
    { name: '$defs', mergeType: 'MergePreferLeft' },
    { name: 'paths', mergeType: 'MergePreferLeft' },
    { name: 'webhooks', mergeType: 'MergePreferLeft' },
    { name: 'operations', mergeType: 'MergePreferLeft' },
  ];

  for (const { name, mergeType } of categories) {
    // Build progressive merge chain
    // For a single entry, the final type is just S0.name
    // For multiple entries, progressively merge: Merge(S0, S1) -> Merge(prev, S2) -> ...
    if (n === 1) {
      lines.push(`type ${capitalize(name)}Final = S0.${name};`);
    } else {
      for (let i = 1; i < n; i++) {
        const left = i === 1 ? `S0.${name}` : `${capitalize(name)}Merge${i - 1}`;
        const right = `S${i}.${name}`;
        const typeName = i === n - 1 ? `${capitalize(name)}Final` : `${capitalize(name)}Merge${i}`;
        lines.push(`type ${typeName} = ${mergeType}<${left}, ${right}>;`);
      }
    }
  }

  lines.push('');
  lines.push('/**');
  lines.push(' * Final exported types combining all schemas. These types represent the complete OpenAPI schema');
  lines.push(' * by merging paths, webhooks, components, $defs, and operations from all individual schemas.');
  lines.push(' */');
  for (const { name } of categories) {
    lines.push(`export type ${name} = ${capitalize(name)}Final;`);
  }
  lines.push('');

  const indexPath = path.resolve(generatedDir, 'index.ts');
  fs.writeFileSync(indexPath, lines.join('\n'));
  console.log(`  ✔ Wrote: ${indexPath}`);
};

/**
 * Allow running directly with:
 * node generators/scripts/generate-openapi-types.mjs getOpenApiSchema
 */
if (process.argv.includes('getOpenApiSchema')) {
  await getOpenApiSchema();
}

export { ensureDirectoryExistence, formatOutput } from './utils.mjs';
export default { getOpenApiSchema };
