// import { ApiErrorResponse } from '../extractors';
// import {
//   ApiFetchInternalOptions,
//   AssertResponseType,
//   ApiFetchResponse,
//   ApiFetchResponseArray,
//   ApiFetchFunc,
//   ApiFetchAllFunc,
// } from '../extractors/fetcher';
// import {
//   baseURL,
//   isFullUrl,
//   buildApiPath,
//   buildSearchParams,
// } from './utils';

/**
 * @description Example of a custom fetch function for the API endpoints.
 * The response, url, config options are typed based on the OpenAPI schema.
 * Extend based on your needs.
 *
 * @param apiEndpoint - The API endpoint to fetch
 * @param config - The configuration options for the fetch request
 * @returns A promise that resolves to the API response
 *
 * @example
 * const { data, error, response } = await apiFetch('/example-custom-endpoint/{pathParam}', {
 *   method: 'post',
 *   queryParams: { userId: '123' },
 *   pathParams: { pathParam: 'example' },
 *   body: { name: 'John', age: 30 }, // auto-stringify the body unless you pass 'stringifyBody: false'
 *   onSuccess: (newData) => console.log(newData),
 *   onError: (newError) => console.log(newError),
 *   withResponseObj: true, // default false
 *   shouldFetch: myCondition, // default true
 * });
 */
// export const apiFetch: ApiFetchFunc = async (apiEndpoint, config) => {
//   // Type helpers
//   type ResponseType = AssertResponseType<typeof apiEndpoint, typeof config.method, typeof config>;
//
//   // Path helpers
//   const apiPath = buildApiPath(apiEndpoint, config?.pathParams as Record<string, string> | undefined);
//   const queryParams = buildSearchParams(config?.queryParams);
//   const fetchUrl = `${isFullUrl(apiPath) ? '' : baseURL}${apiPath}${queryParams}`;
//
//   // Create the fetch options
//   const options: ApiFetchInternalOptions = {
//     method: config.method,
//     credentials: 'same-origin',
//     headers: {
//       ...(config?.body && (config?.stringifyBody ?? true) ? { 'Content-Type': 'application/json' } : {}),
//       ...(config?.headers ?? {}),
//     },
//     // Allow the option of not stringify the payload, useful for FormData
//     ...(config?.body && { body: config?.stringifyBody ?? true ? JSON.stringify(config.body) : config.body as BodyInit }),
//     ...(config?.signal && { signal: config.signal }),
//   };
//
//   // If we don't want to fetch the data, return early
//   if (config?.shouldFetch === false) {
//     return Promise.resolve({
//       data: undefined,
//       error: undefined,
//       response: undefined,
//     });
//   }
//
//   // Fetch the data; assert the response type
//   const response = await fetch(fetchUrl, options);
//
//   // Safely clone the response for further use
//   const clonedResponse = response.clone();
//
//   // Return the ok response
//   if (response.ok) {
//     // if "stream", skip parsing entirely
//     if (config?.parseAs === 'stream') {
//       return {
//         data: response.body,
//         error: undefined,
//         response: config?.withResponseObj ? undefined : clonedResponse,
//       } as ResponseType;
//     }
//
//     // Parse the response based on the parseAs option
//     const parseAs = (config?.parseAs ?? 'json') as 'json' | 'text' | 'blob' | 'arrayBuffer';
//     const data = await response[parseAs]() as ResponseType['data'];
//
//     // Handle onSuccess callback
//     if (config?.onSuccess) config.onSuccess(data as never);
//
//     // return parsed data
//     return {
//       data,
//       error: undefined,
//       response: config?.withResponseObj ? undefined : clonedResponse,
//     } as ResponseType;
//   }
//
//   // Parse the error response
//   let error: ApiErrorResponse<typeof apiEndpoint, typeof config.method>;
//
//   try {
//     // This is a normal API error response, try to parse it
//     error = await response.json() as ApiErrorResponse<typeof apiEndpoint, typeof config.method>;
//   } catch {
//     // Fallback for invalid JSON responses
//     const errorText = await clonedResponse.text();
//     error = {
//       message: errorText || `HTTP ${response.status} - ${response.statusText}`,
//       status: response.status,
//       statusText: response.statusText,
//     } as ApiErrorResponse<typeof apiEndpoint, typeof config.method>;
//   }
//
//   // Handle onError callback
//   if (config?.onError) config.onError(error);
//
//   // Return errors
//   return {
//     data: undefined,
//     error,
//     response: config?.withResponseObj ? undefined : clonedResponse,
//   };
// };

/**
 * @description Helper to make sure we're fetching all the data concurrently using Promise.all.
 * It doesn't short-circuit if one of the promises rejects, instead it returns all the results.
 *
 * @param apiFetches - The array of apiFetch promises to resolve.
 * @returns An array of objects with the data, error and response.
 *
 * @example
 * // Using apiFetchAll with the actions built on top of apiFetch
 * const [
 *   { data: myData },
 *   { data: someData },
 *   { data: otherData },
 * ] = await apiFetchAll([
 *   myFetch({ ...params }),
 *   someFetch({ ...params }),
 *   otherFetch({ ...params }),
 * ]);
 */
// export const apiFetchAll:ApiFetchAllFunc = async (apiFetches) => {
//   // Concurrently fetch all the data
//   const results = await Promise.all(apiFetches);
//
//   // Map over the results and destructure each response with correct typing
//   return results.map((result) => {
//     const { data, error, response } = result as ApiFetchResponse<
//       ApiFetchResponseArray<typeof apiFetches>[number], ApiFetchResponseArray<typeof apiFetches>[number]
//     >;
//     return { data, error, response };
//   }) as ApiFetchResponseArray<typeof apiFetches>;
// };
