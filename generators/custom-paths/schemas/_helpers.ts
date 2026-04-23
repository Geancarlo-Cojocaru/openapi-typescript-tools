/**
 * Helper functions to annotate types in the definition file while remaining no-op at runtime.
 * These exist purely to carry type information in TypeScript, so our generator can extract T from schema<T>().
 * Runtime value is null, so this can be used in const objects.
 */

/**
 * This function is a no-op at runtime and serves only to carry type information.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function schema<T>(): null {
  return null;
}

/** Supported HTTP methods for our endpoints */
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';

/** Definition for a method entry in the multi-method shape */
export type MethodDef = {
  queryParams?: { schema: unknown };
  pathParams?: { schema: unknown };
  body?: { schema: unknown; mediaType?: string };
  okResponse?: { schema: unknown; status?: number; mediaType?: string };
  errorResponse?: { schema: unknown; status?: number; mediaType?: string } | Array<{ schema: unknown; status?: number; mediaType?: string }>;
};

/** Definition shape: path maps to a map of HTTP methods */
export type MultiMethodDef = Partial<Record<HttpMethod, MethodDef>>;

/** Overall definition mapping paths to multi-method definitions only */
export type Definition = Record<string, MultiMethodDef>;
