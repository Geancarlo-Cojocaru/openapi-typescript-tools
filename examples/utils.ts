/**
 * url-template: https://www.npmjs.com/package/url-template
 * qs: https://www.npmjs.com/package/qs
 */
// import { parseTemplate } from 'url-template';
// import { stringify } from 'qs';

/** Types */
// type BuildSearchParamsInput =
//   | Record<string, unknown>
//   | Array<unknown>
//   | string
//   | null
//   | undefined;

/**
 * @description The base URL for API calls.
 * Example: https://api.example.com
 */
// export const baseURL = process.env.YOUR_ENV_KEY ?? '';

/** @description Check if a URL is a full URL (starts with http:// or https://)
 * @param url - The URL string to check.
 * @returns True if the URL is a full URL, false otherwise.
 *
 * @example
 * const result1 = isFullUrl('https://example.com/path'); // true
 * const result2 = isFullUrl('http://example.com/path');  // true
 * const result3 = isFullUrl('/relative/path');           // false
 */
// export const isFullUrl = (url: string): boolean =>
//   url.startsWith('http://') || url.startsWith('https://');

/**
 * @description Build an API path by expanding a URL template with provided path parameters.
 * If no params are provided, the original endpoint is returned unchanged.
 * @param apiEndpoint - The API endpoint as a URL template (e.g., '/v1/resource/{id}').
 * @param pathParams - An object containing path parameters to replace in the template.
 * @returns The expanded API path with path parameters replaced, or the original endpoint if no params are provided.
 *
 * @example
 * // With path parameters
 * const path1 = buildApiPath('/v1/resource/{id}', { id: '123' });
 * // path1 is '/v1/resource/123'
 *
 * // Without path parameters
 * const path2 = buildApiPath('/v1/resource/list');
 * // path2 is '/v1/resource/list'
 */
// export function buildApiPath(apiEndpoint: string | number | symbol, pathParams?: Record<string, string> | null): string {
//   // Strip any #fragment suffix (used as type discriminator only)
//   const cleanEndpoint = String(apiEndpoint).split('#')[0];
//
//   if (pathParams === null || pathParams === undefined) return cleanEndpoint;
//   return parseTemplate(cleanEndpoint).expand(pathParams);
// }

/**
 * @description Build a URL search string from various input types.
 * @param data - Object, array, string, null or undefined
 * @param prefix - String to prepend when there is a query, defaults to '?'
 * @returns Query string starting with the prefix or empty string
 *
 * @example
 * // Using an object
 * const params1 = buildSearchParams({ search: 'shoes', colors: ['red', 'blue'] });
 * // params1 is '?search=shoes&colors%5B0%5D=red&colors%5B1%5D=blue'
 *
 * // Using a string
 * const params2 = buildSearchParams('page=2&sort=asc');
 * // params2 is '?page=2&sort=asc'
 *
 * // Using null or undefined
 * const params3 = buildSearchParams(null);
 * // params3 is ''
 */
// export const buildSearchParams = (
//   data: BuildSearchParamsInput,
//   prefix: string = '?',
// ): string => {
//   // Nullish -> no params
//   if (data === null || data === undefined) return '';
//
//   // If input is already a string, normalize it
//   if (typeof data === 'string') {
//     const trimmed = data.trim();
//     if (!trimmed) return '';
//     // Remove leading ? or & and re-attach the provided prefix
//     const normalized = trimmed.replace(/^[?&]+/, '');
//     return normalized ? `${prefix}${normalized}` : '';
//   }
//
//   // If object or array, stringify via qs
//   if (typeof data === 'object') {
//     const isEmpty = Array.isArray(data)
//       ? data.length === 0
//       : Object.keys(data as Record<string, unknown>).length === 0;
//     if (isEmpty) return '';
//
//     const query = stringify(data, {
//       // common sensible defaults
//       arrayFormat: 'indices',
//       skipNulls: true,
//       encodeValuesOnly: true,
//     });
//
//     return query ? `${prefix}${query}` : '';
//   }
//
//   // Fallback for other primitive types (number, boolean, etc.)
//   const query = stringify(data, { encodeValuesOnly: true });
//   return query ? `${prefix}${query}` : '';
// };
