/**
 * Builds an OpenAPI 3.0 document from local TypeScript route/response definitions.
 * It scans custom-paths.ts for a `definition` object describing routes, HTTP methods, and associated
 * TypeScript types (query/ok/error). It then:
 *  - Collects referenced TypeScript types
 *  - Generates JSON Schemas for those types using ts-json-schema-generator
 *  - Normalizes the produced schemas for OpenAPI components
 *  - Emits an OpenAPI file that can be consumed by openapi-typescript (see generate-openapi-types.mjs)
 *
 * Inputs:
 *  - custom-paths.ts (this file reads it via TypeScript AST) expected to export a `definition` object.
 *  - tsconfig.json (for ts-json-schema-generator)
 *
 * Output:
 *  - custom_openapi.json (OpenAPI 3.0 document with paths and components.schemas)
 *
 * Temp Files:
 *  - ./.tmp/generatedSchemas.ts (ephemeral helper with generated type aliases for schema emission)
 *
 * Usage:
 *  node openapi-new/generators/scripts/generate-openapi-from-custom-paths.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProjectRoot, getFileDir } from './paths.mjs';
import { ensureDirectoryExistence } from './utils.mjs';
import { readSource, collectEndpoints } from './custom-paths/parse-definitions.mjs';
import { registerSchema, prepareTempSchemasFile, buildComponentsSchemas } from './custom-paths/schema-generator.mjs';
import { buildOpenApi } from './custom-paths/build-openapi.mjs';

/** Resolve paths to root */
const rootDir = getProjectRoot(getFileDir(import.meta.url));

const __dirname = getFileDir(import.meta.url);
const generatorsDir = path.resolve(__dirname, '..');
const openapiDir = path.resolve(generatorsDir, '..');

// Input TS file that defines routes/types and output OpenAPI destination
const DEF_FILE = path.resolve(generatorsDir, 'custom-paths/custom-paths.ts');
const OUTPUT_OPENAPI = path.resolve(openapiDir, 'generated-types/custom_openapi.json');
const TSCONFIG_PATH = path.resolve(rootDir, 'tsconfig.json');

const TMP_DIR = path.resolve(generatorsDir, 'custom-paths/.tmp');
const TMP_FILE = path.resolve(TMP_DIR, 'generatedSchemas.ts');

/**
 * Program entry point: parse definitions, generate component schemas, and write the OpenAPI Typescript file.
 */
async function main() {
  console.log('Generating TypeScript from OpenAPI definitions...');
  const sf = readSource(DEF_FILE);
  const endpoints = collectEndpoints(sf, registerSchema);
  // Prepare a single temp file with all generated schema type aliases
  prepareTempSchemasFile(sf, DEF_FILE, TMP_DIR, TMP_FILE);
  const components = buildComponentsSchemas(TMP_FILE, TSCONFIG_PATH);
  const openapi = buildOpenApi(endpoints, components);
  ensureDirectoryExistence(OUTPUT_OPENAPI);
  fs.writeFileSync(OUTPUT_OPENAPI, JSON.stringify(openapi, null, 2));
  console.log(`✔ Wrote OpenAPI to ${OUTPUT_OPENAPI}`);
  // Cleanup temp directory
  try {
    if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } catch (e) {
    console.warn('Warning: failed to cleanup .tmp directory:', e?.message || e);
  }
}

// CLI execution guard: run main() when this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
