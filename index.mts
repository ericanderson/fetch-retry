import invariant from "tiny-invariant";

export interface FetchRetryOptions {
  retries?: number;
  retryDelay?:
    | number
    | ((
        attempt: number,
        error: unknown,
        response: Response | null
      ) => number | Promise<number>);
  retryOn?:
    | number[]
    | ((
        attempt: number,
        error: unknown,
        response: Response | null
      ) => boolean | Promise<boolean>);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function fetchRetryFactory(
  fetch: typeof globalThis.fetch,
  defaults: FetchRetryOptions = {}
) {
  invariant(typeof fetch === "function", "fetch must be a function");
  invariant(typeof defaults === "object", "defaults must be an object");
  invariants(defaults);

  const baseDefaults = {
    retries: 3,
    retryDelay: 1000,
    retryOn: [],
  };

  return async function fetchRetry(
    input: string | URL | globalThis.Request,
    init?: RequestInit & FetchRetryOptions
  ) {
    invariants(init ?? {});
    const retries = init?.retries ?? defaults.retries ?? baseDefaults.retries;
    const retryDelayRaw =
      init?.retryDelay ?? defaults.retryDelay ?? baseDefaults.retryDelay;
    /** @type {NonNullable<FetchRetryOptions["retryDelay"] & Function>} */
    const retryDelay =
      typeof retryDelayRaw === "function"
        ? retryDelayRaw
        : () => {
            return retryDelayRaw;
          };
    const retryOnRaw =
      init?.retryOn ?? defaults.retryOn ?? baseDefaults.retryOn;

    /** @type {NonNullable<FetchRetryOptions["retryOn"] & Function>} */
    const retryOn =
      typeof retryOnRaw === "function"
        ? retryOnRaw
        : (_attempt: any, _error: any, response: Response | undefined | null) =>
            !response || retryOnRaw.indexOf(response.status) !== -1;

    let response: Response | null = null,
      error: unknown = null,
      attempt = 0;

    while (true) {
      response = null;
      error = null;
      try {
        console.log("fetch call ", attempt + 1);
        response = await fetch(input, init);
        console.log("fetch call done success", attempt + 1);
      } catch (e) {
        console.log("fetch call done error", attempt + 1);
        error = e;
      }

      // no point in delaying if this was the last attempt

      if (!(await retryOn(attempt, error, response))) {
        console.log("POST RETRY ON", attempt + 1);
        break;
      } else if (attempt >= retries) {
        break;
      }

      await delay(await retryDelay(attempt, error, response));

      console.log("POST DELAY", attempt + 1);
      attempt++;
    }
    console.log("Should be done");
    if (response) return response;
    throw error;
  };
}

function invariants(defaults: FetchRetryOptions) {
  invariant(
    defaults.retries === undefined || isPositiveInteger(defaults.retries),
    "retries must be a positive integer"
  );
  invariant(
    defaults.retryDelay === undefined ||
      isPositiveInteger(defaults.retryDelay) ||
      typeof defaults.retryDelay === "function",
    "retryDelay must be a positive integer or a function returning a positive integer"
  );
  invariant(
    defaults.retryOn === undefined ||
      Array.isArray(defaults.retryOn) ||
      typeof defaults.retryOn === "function",
    "retryOn property expects an array or function"
  );
}

function isPositiveInteger(value: unknown) {
  return Number.isInteger(value) && (value as number) >= 0;
}
