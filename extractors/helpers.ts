/** HTTP methods */
export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

/** Return any `[string]/[string]` media type (important because openapi-fetch allows any content response, not just JSON-like) */
export type MediaType = `${string}/${string}`;

/** Return `responses` for an Operation Object */
export type ResponseObjectMap<T> = T extends { responses: any } ? T['responses'] : unknown;

/** Get a union of OK Statuses */
export type OKStatusUnion<T> = FilterKeys<T, OkStatus>;

/** Find the first match of multiple keys */
export type FilterKeys<Obj, Matchers> = Obj[keyof Obj & Matchers];

/** 2XX statuses */
export type OkStatus = 200 | 201 | 202 | 203 | 204 | 206 | 207 | '2XX';

/** 5XX and 4XX statuses */
export type ErrorStatus = 500 | 501 | 502 | 503 | 504 | 505 | 506 | 507 | 508 | 510 | 511 | '5XX' | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 420 | 421 | 422 | 423 | 424 | 425 | 426 | 427 | 428 | 429 | 430 | 431 | 444 | 450 | 451 | 497 | 498 | 499 | '4XX' | 'default';

/** Helper to get the required keys of an object. If no keys are required, will be `undefined` with strictNullChecks enabled, else `never` */
type RequiredKeysOfHelper<T> = {
  [K in keyof T]: {} extends Pick<T, K> ? never : K;
}[keyof T];

/** Get the required keys of an object, or `never` if no keys are required */
export type RequiredKeysOf<T> = RequiredKeysOfHelper<T> extends undefined ? never : RequiredKeysOfHelper<T>;
