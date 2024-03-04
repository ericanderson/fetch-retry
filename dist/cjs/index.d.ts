export = fetchRetryFactory;
/**
 *
 * @param {typeof globalThis.fetch} fetch
 * @param {FetchRetryOptions} defaults
 * @returns
 */
declare function fetchRetryFactory(fetch: typeof globalThis.fetch, ...args: any[]): (input: string | URL | globalThis.Request, init?: (RequestInit & FetchRetryOptions) | undefined) => Promise<Response>;
declare namespace fetchRetryFactory {
    export { FetchRetryOptions };
}
type FetchRetryOptions = {
    /**
     * - The number of retries to attempt
     */
    retries?: number | undefined;
    /**
     * - The delay between retries, as an integer or a function that returns an integer
     */
    retryDelay?: number | ((attempt: number, error: unknown, response: Response | null) => number) | undefined;
    /**
     * - The status codes to retry on or a function that determines if a retry should happen
     */
    retryOn?: number[] | ((attempt: number, error: unknown, response: Response | null) => boolean) | undefined;
};
