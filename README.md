# openapi-typescript-tools

A toolkit that extends [openapi-typescript](https://github.com/openapi-ts/openapi-typescript) with type-safe extractors, a flexible type generation pipeline, and optional fetcher utilities.

### Why this package?

While the `openapi-typescript` library provides excellent tools for generating TypeScript types from static OpenAPI schemas, maintaining type safety across a modern frontend application (like Next.js) requires additional utilities. This toolkit bridges that gap by providing:

1.  **Powerful Type Extractors**: Seamlessly extract types for specific schemas, successful responses, error responses, request bodies, path parameters, and query parameters directly from your generated OpenAPI definitions.
2.  **Automated Type Merging**: Automatically generate and merge types from multiple OpenAPI sources into a single, unified source of truth, simplifying imports across your project.
3.  **Support for Legacy/Undocumented APIs**: Easily create JSON documentation and TypeScript schemas for older or non-OpenAPI services using a familiar, type-safe DSL.
4.  **Flexible Fetcher Utilities**: Build custom, type-safe fetchers or lightweight wrappers around `openapi-typescript`'s fetchers to meet specific architectural requirements

> **You don't need to use the generators.** You can use only the extractors by importing from `openapi-typescript-tools/extractors` and supplying your own `components` and `paths` types.

## Table of Contents

- [Installation](#installation)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Using Extractors Without Generators](#using-extractors-without-generators)
- [Type Generation](#type-generation)
- [Adding Types Manually](#adding-undocumented-api-endpoints-manually)
- [Custom Fetchers](#custom-fetchers)
- [Global Namespace Integration](#global-namespace-integration)

## Installation

Copy the utility into your project using one of the following methods:

**Default path (`src/openapi-typescript-tools`):**

```bash
git clone --depth 1 https://github.com/Geancarlo-Cojocaru/openapi-typescript-tools.git src/openapi-typescript-tools && rm -rf src/openapi-typescript-tools/.git
```

**Custom path:**

```bash
git clone --depth 1 https://github.com/Geancarlo-Cojocaru/openapi-typescript-tools.git your/custom/path && rm -rf your/custom/path/.git
```

**If you are using the generators**, you need to install these dev dependencies:

```bash
npm install -D openapi-typescript typescript ts-json-schema-generator
```

and also add the following scripts in your `package.json` for type generation - adjust the paths in the scripts if you installed the tools in a different directory:

```json
{
  "scripts": {
    "openapi:defs": "node ./openapi-typescript-tools/generators/scripts/generate-openapi-from-custom-paths.mjs",
    "openapi:types": "node ./openapi-typescript-tools/generators/scripts/generate-openapi-types.mjs getOpenApiSchema",
    "openapi:generate": "npm run openapi:defs && npm run openapi:types"
  }
}
```

Then in the command line in the project root, run the following command to generate the types.

```bash
npm run openapi:generate
```

## Project Structure

```
openapi-typescript-tools/
├── config.mjs                  # Main entry point — generator configuration
├── extractors/
│   ├── index.ts                # Type extractors (ApiSchema, ApiOkResponse, etc.)
│   ├── fetcher.ts              # Fetcher type definitions (ApiFetchFunc, etc.)
│   └── helpers.ts              # Shared utility types (HttpMethod, MediaType, etc.)
├── generators/
│   ├── scripts/                # Generation scripts
│   └── custom-paths/           # Manual type definitions → OpenAPI JSON
│       ├── custom-paths.ts     # Your custom endpoint definitions
│       ├── schemas/            # Complex type schemas
│       └── README.md           # Detailed custom paths guide
├── generated-types/            # Auto-generated & merged TypeScript types
│   ├── index.ts                # Barrel file (auto-merged)
│   └── customApiSchema.ts      # Generated from custom paths
└── examples/
    ├── fetcher.ts              # Example custom fetcher implementation
    └── utils.ts                # Example utility functions
```

## Quick Start

1. Configure your OpenAPI schemas in [`config.mjs`](./config.mjs) — this is the **main entry point** for generation.
2. Run the type generator to populate `generated-types/`.
3. Import extractors and fetcher types from `extractors/` to build your API layer.

## Using Extractors Without Generators

You can skip the generation pipeline entirely and use only the type extractors. 

To install only the extractors into your project:

```bash
# This will copy only the extractors/ directory
git clone --depth 1 --filter=blob:none --sparse https://github.com/Geancarlo-Cojocaru/openapi-typescript-tools.git temp-tools \
&& cd temp-tools && git sparse-checkout set extractors \
&& mv extractors ../your/custom/path && cd .. && rm -rf temp-tools
```

Then, modify the utilities from `openapi-typescript-tools/extractors` and pass your own `components` and `paths` types:

```ts
// replace in openapi-typescript-tools/extractors/index.ts
import {
  components,
  paths,
} from 'path-to-your-generated-types';
```

These utility types work with any `components` and `paths` that follow the [openapi-typescript](https://github.com/openapi-ts/openapi-typescript) output shape.

### Available Extractor Types

| Type | Description | Example |
|------|-------------|---------|
| `ApiSchema<SchemaName>` | Extract a component schema by name. `SchemaName` must be an existing schema. | `ApiSchema<'User'>` |
| `ApiPathMethods<path>` | Get available HTTP methods for a path. `path` must be an existing path. | `ApiPathMethods<'/products'>` |
| `ApiPathParams<path, method>` | Get path parameters for an endpoint. `path` must be an existing path and `method` must be an existing method for that path. | `ApiPathParams<'/products/{id}', 'get'>` |
| `ApiQueryParams<path, method>` | Get query parameters for an endpoint. `path` must be an existing path and `method` must be an existing method for that path. | `ApiQueryParams<'/products', 'get'>` |
| `ApiRequestBody<path, method>` | Get the request body type. `path` must be an existing path and `method` must be an existing method for that path. | `ApiRequestBody<'/products', 'post'>` |
| `ApiOkResponse<path, method>` | Get the success response type. `path` must be an existing path and `method` must be an existing method for that path. | `ApiOkResponse<'/products', 'get'>` |
| `ApiErrorResponse<path, method>` | Get the error response type. `path` must be an existing path and `method` must be an existing method for that path. | `ApiErrorResponse<'/products', 'get'>` |

## Type Generation

### Configuration

All generations are configured in [`config.mjs`](./config.mjs) — the **main entry point**.

```js
export const generatorConfig = [
  {
    outputName: 'customApiSchema.ts',           // Output file name
    jsonSchemaURL: '/path/to/openapi.json',      // URL or local path to schema
    basicAuth: { username: '', password: '' },   // Optional: HTTP Basic Auth
    pathFilter: ['/products', '/users'],         // Optional: keep only matching paths
  },
];
```

### Generated Types

Types are generated into `generated-types/` and are **automatically merged** in `generated-types/index.ts`. This barrel file combines `paths`, `components`, `$defs`, `webhooks`, and `operations` from all configured schemas into unified exported types.

```ts
// generated-types/index.ts (auto-generated)
export type components = ComponentsFinal;
export type paths = PathsFinal;
// ...
```

The extractors consume these merged types, so everything stays in sync.

## Adding Undocumented API Endpoints Manually

You can define types manually and locally without relying on a remote backend OpenAPI schema. This is handled by the custom paths system. You only need to modify `openapi-typescript-tools/generators/custom-paths/custom-paths.ts` to write TypeScript definitions that get compiled into a local OpenAPI JSON schema and then into generated types.

1. Define your endpoints locally in `openapi-typescript-tools/generators/custom-paths/custom-paths.ts`.
2. Create complex schemas in `openapi-typescript-tools/generators/custom-paths/schemas/`.
3. Use the `schema<T>()` helper to provide type information to the generator.

> **Note:** We only use the local definitions from `openapi-typescript-tools/generators/custom-paths/custom-paths.ts`. No remote connection is required for these custom endpoints.

```ts
import { schema } from './schema-helpers';

const definition = {
  '/my-endpoint': {
    get: {
      okResponse: { schema: schema<{ id: string; name: string }>() },
      errorResponse: { schema: schema<{ error: string }>(), status: 404 },
    },
  },
};
```

See the full guide in [`openapi-typescript-tools/generators/custom-paths/README.md`](./generators/custom-paths/README.md).

## Custom Fetchers

The library provides fetcher type definitions in `extractors/fetcher.ts` that you can use to build **custom, type-safe fetcher functions** — or better yet, **wrappers** around your existing fetch logic for maintainability.

### Key Fetcher Types

| Type | Description |
|------|-------------|
| `ApiFetchFunc` | Function signature for a type-safe fetcher |
| `ApiFetchConfig<Path, Method>` | Fully typed config (path params, query, body, headers, etc.) |
| `ApiFetchResponse<Data, Error>` | Response shape with `data`, `error`, and `response` |
| `AssertResponseType` | Helper for casting response types inside custom fetchers |
| `ParseAs` | Response body format: `json`, `text`, `blob`, `arrayBuffer`, `stream` |
| `ApiFetchAllFunc` | Parallel data fetching with `Promise.all` |

### Building a Custom Fetcher

```ts
import type { ApiFetchFunc, ApiFetchInternalOptions } from 'openapi-typescript-tools/extractors/fetcher';

export const myFetcher: ApiFetchFunc = async (apiEndpoint, config) => {
  type ResponseType = AssertResponseType<typeof apiEndpoint, typeof config.method, typeof config>;

  const options: ApiFetchInternalOptions = {
    method: config.method.toUpperCase() as HttpMethod,
    credentials: 'same-origin',
    // ... your custom logic
  };

  // ... fetch and return { data, error, response }
};
```

> **See commented examples** in [`examples/fetcher.ts`](./examples/fetcher.ts) and [`examples/utils.ts`](./examples/utils.ts) for full implementation patterns including error handling, query serialization, and parallel fetching.

## Global Namespace Integration

To avoid importing extractor utilities in every file, you can add them to your project's global namespace. This is especially useful in large projects with many components.

Example configuration in `src/types/global.ts`:

```ts
import type {
  ApiSchema as OpenApiSchema,
  ApiOkResponse as OpenApiOkResponse,
  ApiErrorResponse as OpenApiErrorResponse,
  ApiPathMethods as OpenApiPathMethods,
  ComponentsKeys,
  UsedPaths,
} from '@/openapi-typescript-tools/extractors';

declare global {
  /**
   * @extends OpenApiSchema
   */
  type ApiSchema<SchemaName extends ComponentsKeys> = OpenApiSchema<SchemaName>;

  /**
   * @extends OpenApiErrorResponse
   */
  type ApiErrorResponse<
    Path extends keyof UsedPaths, 
    Method extends OpenApiPathMethods<Path>
  > = OpenApiErrorResponse<Path, Method>;

  /**
   * @extends OpenApiOkResponse
   */
  type ApiOkResponse<
    Path extends keyof UsedPaths, 
    Method extends OpenApiPathMethods<Path>
  > = OpenApiOkResponse<Path, Method>;
}
```

Now you can use `ApiSchema`, `ApiOkResponse`, and `ApiErrorResponse` anywhere in your codebase without imports.

## License

[MIT](LICENSE)
