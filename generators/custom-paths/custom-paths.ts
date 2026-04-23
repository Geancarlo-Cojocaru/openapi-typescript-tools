import { type Definition, schema } from './schemas/_helpers';

/**
 * Custom schemas, to simplify writing the definition.
 * Use https://app.quicktype.io/ to generate them.
 */
import type { SchemaExample } from './schemas/example';

/**
 * Custom API endpoints definition
 * - `mediaType` defaults to `application/json` if not specified
 * - `status` defaults to `200` for `okResponse` and `400` for `errorResponse` if not specified
 * - `pathParams` are inferred from the path (e.g., `/user/{userId}` infers `userId` as a path parameter)
 * - use `schema<T>()` to annotate types for queryParams, pathParams, and responses
 * - supports multiple error responses as an array
 */
export const definition = {
  '/example-custom-endpoint/{pathParam}': {
    post: {
      queryParams: { schema: schema<{ userId: string; }>() },
      pathParams: { schema: schema<{ pathParam: string; }>() },
      body: { schema: schema<{ name: string; age?: number }>() },
      okResponse: { schema: schema<{ user: string; id: string; age?: number; description: string }>() },
      errorResponse: { schema: schema<{ errorMsg: string, errorCode: number }>() },
    },
    get: {
      pathParams: { schema: schema<{ pathParam: string; }>() },
      okResponse: { schema: schema<SchemaExample>() },
      errorResponse: { schema: schema<{ errorMsg: string, errorCode: number }>() },
    },
  },
} as const satisfies Definition;
