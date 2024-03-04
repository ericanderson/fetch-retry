'use strict';

var invariant = require('tiny-invariant');

// @ts-check

/**
 * @typedef {object} FetchRetryOptions
 * @property {number =} [retries=3] - The number of retries to attempt
 * @property {number | ((attempt: number, error: unknown, response: Response | null) => number) =} [retryDelay=1000] - The delay between retries, as an integer or a function that returns an integer
 * @property {number[] | ((attempt: number, error: unknown, response: Response | null) => boolean) =} [retryOn=[]] - The status codes to retry on or a function that determines if a retry should happen
 */

/**
 *
 * @param {number} ms
 * @returns
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 *
 * @param {typeof globalThis.fetch} fetch
 * @param {FetchRetryOptions} defaults
 * @returns
 */
function fetchRetryFactory(fetch) {
  var _defaults;
  let defaults = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  defaults = {
    ...((_defaults = defaults) !== null && _defaults !== void 0 ? _defaults : {})
  };
  invariant(typeof fetch === "function", "fetch must be a function");
  invariant(typeof defaults === "object", "defaults must be an object");
  invariants(defaults);
  const baseDefaults = {
    retries: 3,
    retryDelay: 1000,
    retryOn: []
  };

  /**
   *
   * @param {string | URL | globalThis.Request} input
   * @param { RequestInit & FetchRetryOptions =} init
   */
  return async function fetchRetry(input, init) {
    var _ref, _init$retries, _ref2, _init$retryDelay, _ref3, _init$retryOn;
    invariants(init !== null && init !== void 0 ? init : {});
    const retries = (_ref = (_init$retries = init === null || init === void 0 ? void 0 : init.retries) !== null && _init$retries !== void 0 ? _init$retries : defaults.retries) !== null && _ref !== void 0 ? _ref : baseDefaults.retries;
    const retryDelayRaw = (_ref2 = (_init$retryDelay = init === null || init === void 0 ? void 0 : init.retryDelay) !== null && _init$retryDelay !== void 0 ? _init$retryDelay : defaults.retryDelay) !== null && _ref2 !== void 0 ? _ref2 : baseDefaults.retryDelay;
    /** @type {NonNullable<FetchRetryOptions["retryDelay"] & Function>} */
    const retryDelay = typeof retryDelayRaw === "function" ? retryDelayRaw : () => {
      console.log("CUSTOM DELAY", retryDelayRaw);
      return retryDelayRaw;
    };
    const retryOnRaw = (_ref3 = (_init$retryOn = init === null || init === void 0 ? void 0 : init.retryOn) !== null && _init$retryOn !== void 0 ? _init$retryOn : defaults.retryOn) !== null && _ref3 !== void 0 ? _ref3 : baseDefaults.retryOn;

    /** @type {NonNullable<FetchRetryOptions["retryOn"] & Function>} */
    const retryOn = typeof retryOnRaw === "function" ? retryOnRaw : (_attempt, _error, response) => !response || retryOnRaw.indexOf(response.status) !== -1;
    let /** @type {Response|null} */response = null,
      /** @type {unknown|null} */error = null;
    for (let attempt = 0; attempt < retries; attempt++, response = null, error = null) {
      try {
        response = await fetch(input, init);
      } catch (e) {
        error = e;
      }
      if (!(await retryOn(attempt, error, response))) {
        break;
      }
      await delay(retryDelay(attempt, error, response));
      console.log("POST DELAY");
    }
    if (response) return response;
    throw error;
  };
}

/**
 * @param {FetchRetryOptions} defaults
 */
function invariants(defaults) {
  invariant(defaults.retries === undefined || isPositiveInteger(defaults.retries), "retries must be a positive integer");
  invariant(defaults.retryDelay === undefined || isPositiveInteger(defaults.retryDelay) || typeof defaults.retryDelay === "function", "retryDelay must be a positive integer or a function returning a positive integer");
  invariant(defaults.retryOn === undefined || Array.isArray(defaults.retryOn) || typeof defaults.retryOn === "function", "retryOn property expects an array or function");
}

/**
 * @param {?} value
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && /** @type {number} */value >= 0;
}

module.exports = fetchRetryFactory;
