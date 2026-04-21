# Custom OpenAPI Paths

This directory handles the generation of custom OpenAPI definitions for endpoints that are not automatically extracted from the API.
This is particularly useful when:
- **Undocumented APIs**: You are working with legacy or internal endpoints that are not yet covered by the official OpenAPI documentation.
- **Manual Overrides**: You need to provide more precise type information than what the automatic extractor can determine.
- **Complex Responses**: The endpoint returns non-standard data types (like binary files or plain text) that require manual schema definition.
- **Rapid Prototyping**: You want to quickly define an endpoint's contract before it's fully implemented or documented on the backend.

## How to Write Custom Paths

All custom paths are defined in `custom-paths.ts` within the `definition` object.

### The `definition` Structure

The `definition` object is a map where:
- **Key**: The API endpoint path (e.g., `/api/my-endpoint` or `/user/{userId}`).
- **Value**: An object mapping HTTP methods (`get`, `post`, `put`, etc.) to their respective configurations.

### `MethodDef` Configuration

Each method configuration can include:
- `queryParams`: Schema for URL query parameters.
- `pathParams`: Schema for path parameters (if not automatically inferred).
- `body`: Schema and media type for the request body.
- `okResponse`: Schema, status, and media type for successful responses.
- `errorResponse`: Schema, status, and media type for error responses (can be a single object or an array of objects).

### Using `schema<T>()`

To provide type information to the generator, use the `schema<T>()` helper function. This function is a no-op at runtime but allows the generator to extract the TypeScript interface/type `T`.

```ts
import { schema } from './schema-helpers';
import { MyResponseType } from './schemas';

// ... inside definition
const definition = {
  '/my-endpoint': {
    get: {
      okResponse: { schema: schema<MyResponseType>() }
    }
  }
};
```

### Response Helpers

Some common response types are pre-defined in `schemas/common.ts`:

- **`BinaryFileResponse`**: Used for endpoints returning files (e.g., PDFs, ZIPs, Excel files). Usually paired with a specific `mediaType`.
- **`PlainText`**: Used for endpoints returning raw text (e.g., error messages in `text/plain`).

## Examples

### 1. Basic GET Request

```ts
const definition = {
  '/user/{userId}': {
    get: {
      // pathParams { userId: string } is automatically inferred from the path
      okResponse: { schema: schema<{ id: string; name: string }>() },
      errorResponse: { schema: schema<{ error: string }>(), status: 404 }
    }
  }
};
```

### 2. POST Request with Body and Query Params

```ts
const definition = {
  '/items': {
    post: {
      queryParams: { schema: schema<{ region: string }>() },
      body: { schema: schema<{ title: string; price: number }>() },
      okResponse: { schema: schema<{ id: string }>() }
    }
  }
};
```

### 3. Binary File Download (e.g., ZIP)

When returning binary data, use `BinaryFileResponse` and specify the correct `mediaType`.

```ts
const definition = {
  '/api/reports/download': {
    get: {
      queryParams: { schema: schema<{ reportId: string }>() },
      okResponse: { 
        schema: schema<BinaryFileResponse>(), 
        mediaType: 'application/zip' 
      },
      errorResponse: { 
        schema: schema<PlainText>(), 
        status: 400, 
        mediaType: 'text/plain' 
      }
    }
  }
};
```

### 4. Plain Text Error Response

If an API returns a simple string as an error instead of JSON:

```ts
const errorResponse = { 
  schema: schema<PlainText>(), 
  status: 500, 
  mediaType: 'text/plain' 
};
```

### 5. Multiple Error Responses

```ts
const errorResponse = [
  { schema: schema<{ message: string }>(), status: 400 },
  { schema: schema<{ error: string; code: string }>(), status: 401 }
];
```

## Schemas

If your types are complex, avoid defining them inline. Instead:

### 1. Create a Schema File
Create a new file in `schemas/` (e.g., `schemas/orders.ts`).

```ts
// schemas/orders.ts
export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
}

export interface OrdersResponse {
  items: OrderItem[];
  total: number;
}
```

### 2. Export the Schema
Export your types from `schemas/index.ts`.

```ts
// schemas/index.ts
export type { 
  OrdersResponse,
  OrderItem 
} from './orders';
```

### 3. Use in `custom-paths.ts`
Import the types and use them with `schema<T>()`.

```ts
// custom-paths.ts
import { OrdersResponse } from './schemas';

const definition = {
  // ... inside definition
  okResponse: { schema: schema<OrdersResponse>() }
};
```

Tip: You can use [quicktype.io](https://app.quicktype.io/) to generate TypeScript interfaces from JSON samples.
