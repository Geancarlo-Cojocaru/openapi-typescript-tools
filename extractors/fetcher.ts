import type {
  HttpMethod,
  RequiredKeysOf,
} from './helpers';
import type {
  UsedPaths,
  ApiPathParams,
  ApiQueryParams,
  ApiRequestBody,
  ApiOkResponse,
  ApiErrorResponse,
  ApiPathMethods,
} from './index';

/** Helpers */
type GenericObject = { [key: string | number]: unknown; };
type ExtendedProp<T = undefined> = T extends object ? T & GenericObject : GenericObject;
type IsPropRequired<T> = T extends undefined ? false : true;

/**
 * @description Response body type.
 * It provides the types for different body formats that can be parsed from a response.
 */
export type BodyType<T = unknown> = {
  json: T;
  text: Awaited<ReturnType<Response['text']>>;
  blob: Awaited<ReturnType<Response['blob']>>;
  arrayBuffer: Awaited<ReturnType<Response['arrayBuffer']>>;
  stream: Response['body'];
};

/**
 * @description The type of the response body to parse.
 * It can be one of the following: `json`, `text`, `blob`, `arrayBuffer`, `stream`
 * */
export type ParseAs = keyof BodyType;

/**
 * @description Parse the response of your custom fetcher function.
 * It returns the type of the parsed response based on the provided `parseAs` option.
 * If no `parseAs` option is provided, it returns the original response type.
 *
 * @example
 * const myFetcherConfig = { parseAs: 'json', ... };
 */
export type ParseAsResponse<T, Options> = Options extends { parseAs: ParseAs; } ? BodyType<T>[Options['parseAs']] : T;

/**
 * @description The shape of the response object for your custom fetcher function.
 * @example
 * const { data, error, response } = await myCustomFetcher(...);
 */
export interface ApiFetchResponse<DataType, ErrorType> {
  data: DataType | undefined;
  error: ErrorType | undefined;
  response: Response | undefined;
}

/**
 * @description Helper type for ApiFetchResponse, if you need casting.
 * @example
 * // consider this custom fetcher function
 * export const myCustomFetcher: ApiFetchFunc = async (apiEndpoint, config) => {
 *   // You need to cast the response type to the correct type
 *   type ResponseType = AssertResponseType<typeof apiEndpoint, typeof config.method, typeof config>;
 *   ...
 * }
 */
export type AssertResponseType<
  Path extends keyof UsedPaths,
  Method extends ApiPathMethods<Path>,
  Options extends ApiFetchConfig<Path, Method>,
> = ApiFetchResponse<ParseAsResponse<ApiOkResponse<Path, Method>, Options>, ParseAsResponse<ApiErrorResponse<Path, Method>, Options>>;

/**
 * @description The apiFetch request options.
 * To be used internally by your custom fetcher function.
 *
 * @example
 * // Create the fetch options
 * const options: ApiFetchInternalOptions = {
 *   method: (config.method).toUpperCase() as HttpMethod,
 *   credentials: 'same-origin',
 *   ...,
 * }
 */
export interface ApiFetchInternalOptions {
  method: HttpMethod,
  credentials?: RequestCredentials,
  headers?: HeadersInit,
  body?: BodyInit,
  signal?: AbortSignal,
}

/**
 * @description Custom fetcher base config.
 * This should not be used directly, use ApiFetchConfig instead.
 */
export interface ApiFetchBaseConfig<Path extends keyof UsedPaths, Method> {
  method: Method,
  withResponseObj?: boolean, // whether to return the response object or not
  headers?: Record<string, string>,
  parseAs?: ParseAs, // the type of the response body to parse
  queryParams?: ExtendedProp<ApiQueryParams<Path, ApiPathMethods<Path>>>,
  signal?: AbortSignal,
  stringifyBody?: boolean,
  shouldFetch?: boolean, // whether to actually fetch or not, generally used for conditional fetching
  onSuccess?: (data?: ApiOkResponse<Path, ApiPathMethods<Path>>) => void, // callback for successful response
  onError?: (error?: ApiErrorResponse<Path, ApiPathMethods<Path>>) => void, // callback for error response
}

/** @description The config type for your custom fetcher function.
 * It makes the pathParams & body Required or Optional depending on the API endpoint schema.
 *
 * @example
 * const config: ApiFetchConfig<'/users/{userId}', 'post'> = {
 *   headers: { 'Content-Type': 'application/json' },
 *   pathParams: { userId: '123' },
 *   queryParams: { someParam: 10 },
 *   body: { name: 'John' },
 *   parseAs: 'json',
 *   onSuccess: (data) => console.log(data),
 *   onError: (error) => console.error(error),
 *   shouldFetch: myCondition,
 *   withResponse: false,
 *   locale: 'ro',
 * };
 */
export type ApiFetchConfig<Path extends keyof UsedPaths, Method extends ApiPathMethods<Path>> =
  (IsPropRequired<ApiPathParams<Path, Method>> extends false
    ? ApiFetchBaseConfig<Path, Method> & { pathParams?: never }
    : ApiFetchBaseConfig<Path, Method> & { pathParams: ApiPathParams<Path, ApiPathMethods<Path>> })
  & (ApiRequestBody<Path, Method> extends undefined
    ? { body?: never }
    : IsPropRequired<RequiredKeysOf<ApiRequestBody<Path, Method>>> extends false
      ? { body?: ApiRequestBody<Path, ApiPathMethods<Path>> }
      : { body: ApiRequestBody<Path, ApiPathMethods<Path>> }
  );

/**
 * @description The function signature for your custom fetcher function.
 * @param apiEndpoint - The API endpoint path.
 * @param config - The configuration object for the fetch request (uses the ApiFetchConfig type).
 * @returns A promise that resolves to an object containing the data, error, and response objects.
 *
 * @example
 * export const myCustomFetcher: ApiFetchFunc = async (apiEndpoint, config) => {
 *   ...
 * }
 */
export type ApiFetchFunc = <
  Path extends keyof UsedPaths,
  Method extends ApiPathMethods<Path>,
  Options extends ApiFetchConfig<Path, Method>,
>(
  apiEndpoint: Path,
  config: Options & { method: Method },
) => Promise<ApiFetchResponse<ParseAsResponse<ApiOkResponse<Path, Method>, Options>, ParseAsResponse<ApiErrorResponse<Path, Method>, Options>>>;


// ------------------------------------------------------------------
// PARALLED DATA FETCHING
// ------------------------------------------------------------------
/** Utility type to extract the resolved value from a promise */
export type ApiFetchResponseArray<T extends ReturnType<ApiFetchFunc>[]> = {
  [K in keyof T]: T[K] extends Promise<infer R> ? R : never;
};

/** Function signature for the apiFetchAll function. To be used with promiseAll */
export type ApiFetchAllFunc = <
  T extends ReturnType<ApiFetchFunc>[],
>(apiFetches: [...T]) => Promise<ApiFetchResponseArray<T>>;
