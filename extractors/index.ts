import type {
  components,
  paths,
} from '../generated-types';
import type {
  HttpMethod,
  FilterKeys,
  MediaType,
  ResponseObjectMap,
  OKStatusUnion,
  ErrorStatus,
} from './helpers';

/**
 * @description Utility type for getting the keys of the components' object from the API schema.
 */
export type ComponentsKeys = keyof components['schemas'];

/**
 * @description Utility type for getting the paths object from the API schema.
 */
export type UsedPaths = paths;

/**
 * @description Utility type for getting the type of the desired component schema from API.
 * You can find the schemas in your API documentation under 'Schemas' or by expanding the endpoint
 * description and clicking the schema tab.
 *
 * @example
 * type Schema = ApiSchema<'User'>;
 */
export type ApiSchema<SchemaName extends ComponentsKeys> = components['schemas'][SchemaName];

/** Filter out keys with never values and intersect with another type (i.e.: ValidKeys<Interface, HttpMethods>) */
type ValidKeys<T, R extends keyof T> = {
  [K in keyof Required<T>]-?: Required<T>[K] extends never ? never : (K extends R ? K : never)
}[keyof Required<T>];

/** Get a union of Error Statuses */
type ErrorStatusUnion<T> = FilterKeys<T, ErrorStatus>;

/**
 * @description The available methods for an API path.
 *
 * @example
 * type Methods = ApiPathMethods<'/some/endpoint/path'>;
 */
export type ApiPathMethods<
  Path extends keyof paths,
> = ValidKeys<paths[Path], HttpMethod>;

/** Utility type for getting the type of the desired API endpoint parameters: 'query', 'path', 'header' and 'cookie'. */
type EndpointParams<
  Path extends keyof paths,
  Method extends ApiPathMethods<Path>,
> = 'parameters' extends keyof paths[Path][Method]
  ? paths[Path][Method]['parameters']
  : never;

/** Utility types for getting the type of the desired parameters. */
type EndpointPathParams<T> = 'path' extends keyof T ? T['path'] : never;
type EndpointQueryParams<T> = 'query' extends keyof T ? T['query'] : never;

/** Utility type for getting the type of the desired API endpoint request body. */
type EndpointRequestBody<
  Path extends keyof paths,
  Method extends ApiPathMethods<Path>,
> = 'requestBody' extends keyof paths[Path][Method]
  ? paths[Path][Method]['requestBody']
  : never;

/** Utility types for getting the type of the request body content. */
type EndpointRequestBodyContent<T> = T extends { content: infer C } ? C : never;
type EndpointRequestBodyMediaContent<T> =
  T extends never ? undefined :
    T extends { [key in MediaType]: infer C } ? C : never;

/** Utility type for getting the type of the desired API endpoint OK response. */
type EndpointOkUnion<
  Path extends keyof paths,
  Method extends ApiPathMethods<Path>,
> = OKStatusUnion<ResponseObjectMap<paths[Path][Method]>>;

/** Utility type for getting the type of the desired API endpoint Error response. */
type EndpointErrorUnion<
  Path extends keyof paths,
  Method extends ApiPathMethods<Path>,
> = ErrorStatusUnion<ResponseObjectMap<paths[Path][Method]>>;

/** Utility type for getting the type of the response content. Account for 204 responses status (no-content) */
type EndpointContentResponse<T> = 'content' extends keyof T ? T['content'] : never;

/** Utility type for getting the type of the desired API endpoint response media content. */
type EndpointResponseMediaContent<T> =
  T extends never ? never :
    T extends { [key in MediaType]: infer C } ? C : undefined;

/**
 * @description Utility type for getting the path parameters for a given API endpoint.
 *
 * @example
 * type PathParams = ApiPathParams<'/some/endpoint/path', 'get'>;
 */
export type ApiPathParams<
  Path extends keyof paths,
  Method extends ApiPathMethods<Path>,
> = EndpointPathParams<EndpointParams<Path, Method>>;

/**
 * @description Utility type for getting the URL query parameters for a given API endpoint.
 *
 * @example
 * type QueryParams = ApiQueryParams<'/some/endpoint/path', 'get'>;
 */
export type ApiQueryParams<
  Path extends keyof paths,
  Method extends ApiPathMethods<Path>,
> = EndpointQueryParams<EndpointParams<Path, Method>>;

/**
 * @description Utility type for getting the request body for a given API endpoint.
 *
 * @example
 * type RequestBody = ApiRequestBody<'/some/endpoint/path', 'post'>;
 */
export type ApiRequestBody<
  Path extends keyof paths,
  Method extends ApiPathMethods<Path>,
> = EndpointRequestBodyMediaContent<EndpointRequestBodyContent<EndpointRequestBody<Path, Method>>>;

/**
 * @description Utility type for getting the OK response for a given API endpoint.
 * For 204 it is undefined.
 *
 * @example
 * type Response = ApiOkResponse<'/some/endpoint/path', 'get'>;
 */
export type ApiOkResponse<
  Path extends keyof paths,
  Method extends ApiPathMethods<Path>,
> = EndpointResponseMediaContent<EndpointContentResponse<EndpointOkUnion<Path, Method>>>;

/**
 * @description Utility type for getting the Error response for a given API endpoint.
 *
 * @example
 * type ErrorResponse = ApiErrorResponse<'/some/endpoint/path', 'get'>;
 */
export type ApiErrorResponse<
  Path extends keyof paths,
  Method extends ApiPathMethods<Path>,
> = EndpointResponseMediaContent<EndpointContentResponse<EndpointErrorUnion<Path, Method>>>;
