import path from 'path';
import { getFileDir } from './generators/scripts/paths.mjs';

/** Helpers */
const openapiDir = path.resolve(getFileDir(import.meta.url));

/**
 * @description Generator configuration — list of OpenAPI schemas to generate TypeScript types from.
 * Each entry defines a source schema and an output name for the generated types file.
 * The order of entries determines the precedence of schema resolution (first entry wins).
 *
 * **Object keys**:
 * - `outputName` — **string** (required) — File name (including `.ts` extension) for the generated types file.
 *    The file will be placed in the `generated` directory automatically.
 * - `jsonSchemaURL` — **string** (required) — URL or local path to the OpenAPI JSON schema.
 *    Supports `http(s)://` URLs and local file paths (absolute or relative to project root).
 * - `basicAuth` — **{ username: string, password: string }** (optional) — HTTP Basic Auth credentials
 *    used to fetch the schema when the endpoint requires authentication.
 * - `pathFilter` — **string[]** (optional) — List of path prefixes to keep from the schema.
 *    Only paths starting with one of these prefixes will be included in the generated output.
 *    Referenced `components/schemas` are automatically resolved and kept.
 *
 * @example
 * export const generatorConfig = [
 *   { // Custom - Generated from your manual TS definitions
 *     outputName: 'customApiSchema.ts',
 *     jsonSchemaURL: `${openapiDir}/generated-types/custom_openapi.json`,
 *   },
 *   { // Minimal entry — remote schema, no auth, no filtering
 *     outputName: 'basicApiSchema.ts',
 *     jsonSchemaURL: 'https://some-api-address/internal/doc.json',
 *   },
 *   { // Entry with auth and path filtering
 *     outputName: 'complexApiSchema.ts',
 *     jsonSchemaURL: 'https://another-api-address/internal/doc.json',
 *     basicAuth: { username: 'api_username', password: 'api_password' },
 *     pathFilter: ['/products', '/users'], // if supported
 *   },
 * ];
 */
export const generatorConfig = [
  { // Custom - Generated from your manual TS definitions
    outputName: 'customApiSchema.ts',
    jsonSchemaURL: `${openapiDir}/generated-types/custom_openapi.json`,
  },
];
