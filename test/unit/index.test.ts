import { beforeEach } from "vitest";
// @ts-check

/**
 * @typedef {object} FetchRetryOptions
 * @property {number =} [retries=3] - The number of retries to attempt
 * @property {number | ((attempt: number, error: unknown, response: Response | null) => number) =} [retryDelay=1000] - The delay between retries, as an integer or a function that returns an integer
 * @property {number[] | ((attempt: number, error: unknown, response: Response | null) => boolean) =} [retryOn=[]] - The status codes to retry on or a function that determines if a retry should happen
 */

import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fetchBuilder from "../../index";
import type { FetchRetryOptions } from "../..";
// var fetchBuilder = require("../../");
// var sinon = require("sinon");
// var expect = require("expectations");

function itThrowsInvariant<T extends (...args: any[]) => any>(
  fn: T,
  message: string
) {
  it(`rejects with error: ${message}`, () => {
    expect(function () {
      fn();
    }).toThrowError(new Error(`Invariant failed: ${message}`));
  });
}

function itRejectsInvariant<T extends (...args: any[]) => any>(
  fn: T,
  message: string
) {
  it(`rejects with error: ${message}`, async () => {
    expect(fn()).rejects.toThrowError(
      new Error(`Invariant failed: ${message}`)
    );
  });
}

describe("fetchBuilder", function () {
  itThrowsInvariant(() => fetchBuilder(), "fetch must be a function");

  itThrowsInvariant(
    () => fetchBuilder(function () {}, "this is a string, not an object"),
    "defaults must be an object"
  );

  it("returns fetchRetry when provided valid constructor arguments", function () {
    expect(typeof fetchBuilder(function () {}, { retries: 1 })).toBe(
      "function"
    );
  });
});

describe("fetch-retry", function () {
  let fetch: Mock<
    Parameters<typeof globalThis.fetch>,
    ReturnType<typeof globalThis.fetch>
  >;
  let fetchRetry: Mock<
    [
      input: RequestInfo | URL,
      init?: (RequestInit & FetchRetryOptions) | undefined
    ],
    ReturnType<typeof globalThis.fetch>
  >;

  let deferreds: ReturnType<typeof defer>[] = [];

  let deferred1: ReturnType<typeof defer>;
  let deferred2: ReturnType<typeof defer>;
  let deferred3: ReturnType<typeof defer>;
  let deferred4: ReturnType<typeof defer>;

  let thenCallback: Mock<any, any>;
  let catchCallback: Mock<any, any>;
  let fetchRetryChain;

  let delay;

  beforeEach(function () {
    delay = 1000;
    vi.useFakeTimers();
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  beforeEach(function () {
    deferred1 = defer();
    deferred2 = defer();
    deferred3 = defer();
    deferred4 = defer();
    deferreds = [deferred1, deferred2, deferred3, deferred4];

    fetch = vi.fn<
      Parameters<typeof globalThis.fetch>,
      ReturnType<typeof globalThis.fetch>
    >();
    fetch
      .mockReturnValueOnce(deferred1.promise)
      .mockReturnValueOnce(deferred2.promise)
      .mockReturnValueOnce(deferred3.promise)
      .mockReturnValueOnce(deferred4.promise);

    fetchRetry = fetchBuilder(fetch);
  });

  function initiateFetchWithInitOptions(
    fn?: FetchRetryOptions | (() => FetchRetryOptions),
    url = "http://someurl"
  ) {
    return () => {
      thenCallback = vi.fn();
      catchCallback = vi.fn();

      fetchRetryChain = fetchRetry(
        url,
        fn != undefined ? (typeof fn == "function" ? fn() : fn) : undefined
      )
        .then(thenCallback)
        .catch(catchCallback);
    };
  }

  describe("#input", function () {
    var expectedUrl = "http://some-url.com";

    beforeEach(initiateFetchWithInitOptions(undefined, expectedUrl));

    it("passes #input to fetch", function () {
      expect(fetch.mock.calls[0][0]).toBe(expectedUrl);
    });
  });

  describe("#init", function () {
    describe("when #init is provided", function () {
      const init = {
        retries: 3,
        whatever: "something",
      };

      beforeEach(initiateFetchWithInitOptions(init));

      it("passes init to fetch", function () {
        expect(fetch.mock.calls[0][1]).toEqual(init);
      });

      describe("when #init.retryOn is not an array or function", () => {
        itRejectsInvariant(
          () => fetchRetry("http://someUrl", { ...init, retryOn: 503 as any }),
          "retryOn property expects an array or function"
        );
      });
    });

    describe("when #init is undefined or null", function () {
      [undefined, null].forEach(function (testCase) {
        beforeEach(initiateFetchWithInitOptions(testCase as any));

        it("does not pass through init to fetch", function () {
          expect(fetch.mock.calls[0][1]).toEqual(undefined);
        });
      });
    });
  });

  function resolveDeferred(deferredNum: number, status: number) {
    return () => {
      deferreds[deferredNum - 1].resolve({ status });
    };
  }

  function rejectDeferred(deferredNum: number, error?: unknown) {
    return () => {
      deferreds[deferredNum - 1].reject(error);
    };
  }

  // function resolveDeferredAndAdvanceTime(
  //   deferredNum: number,
  //   value: { status: number },
  //   delayTime?: number
  // ) {
  //   return async () => {
  //     deferreds[deferredNum - 1].resolve(value);
  //     vi.advanceTimersByTime(delayTime ?? delay);
  //     await Promise.resolve();
  //   };
  // }

  // function rejectDeferredAndAdvanceTime(
  //   deferredNum: number,
  //   delayTime?: number,
  //   rejectValue?: unknown
  // ) {
  //   return async () => {
  //     deferreds[deferredNum - 1].reject(rejectValue);
  //     vi.advanceTimersByTime(delayTime ?? delay);
  //     await Promise.resolve();
  //   };
  // }

  // function beforeEachRejectDeferredAndAdvanceTime(
  //   deferredNum: number,
  //   delayTime: number,
  //   rejectValue?: unknown
  // ) {
  //   beforeEach(
  //     rejectDeferredAndAdvanceTime(deferredNum, delayTime, rejectValue)
  //   );
  // }

  // function beforeEachResolveDeferredAndAdvanceTime(
  //   deferredNum: number,
  //   value: { status: number },
  //   delayTime: number
  // ) {
  //   beforeEach(resolveDeferredAndAdvanceTime(deferredNum, value, delayTime));
  // }

  function advanceTime(retryDelay?: number) {
    return async () => {
      vi.advanceTimersByTime(retryDelay ?? delay);
      vi.runAllTicks();
      await Promise.resolve();
      await Promise.resolve();
    };
  }

  function itHasCalledFetchOnlyNTimes(n: number) {
    it(`calls fetch ${n} times`, function () {
      expect(fetch.mock.calls.length).toBe(n);
    });
  }

  function itHasInvokedTheThenCallback() {
    it("invokes the then callback", function () {
      expect(thenCallback.mock.calls.length).toBe(1);
    });
  }

  function itHasInvokedTheCatchCallback() {
    it("invokes the then callback", function () {
      expect(catchCallback.mock.calls.length).toBe(1);
    });
  }

  function whenNthCallIsSuccessful(n: number) {
    describe(`when ${n}th call is a success`, function () {
      beforeEach(resolveDeferred(n, 200));
      beforeEach(advanceTime());

      describe("when resolved", function () {
        itHasInvokedTheThenCallback();
        itHasCalledFetchOnlyNTimes(n);
      });
    });
  }

  function whenRejectedOnLastRound(n: number) {
    describe("when rejected", function () {
      beforeEach(advanceTime());

      it("invokes the catch callback", function () {
        expect(catchCallback.mock.calls.length).toBe(1);
      });

      it("does not call fetch again", function () {
        expect(fetch.mock.calls.length).toBe(n);
      });
    });
  }

  function describeProperNRetries(n: number) {
    function recurseRound(i: number) {
      whenNthCallIsSuccessful(i);

      describe(`when ${i}th call is a failure`, function () {
        beforeEach(rejectDeferred(i));
        beforeEach(advanceTime(delay));

        // beforeEach(advanceTime(delay));

        if (i === n + 1) {
          whenRejectedOnLastRound(i);
        } else {
          return recurseRound(i + 1);
        }
      });
    }

    return recurseRound(1);
  }

  describe("#init.retries", function () {
    describe("when #init.retries=3 (default)", function () {
      beforeEach(initiateFetchWithInitOptions());
      describeProperNRetries(3);
    });

    describe("when #defaults.retries is not a a positive integer", () => {
      ["1", -1, "not a number", null].forEach((invalidRetries) => {
        itThrowsInvariant(
          () => fetchBuilder(function () {}, { retries: invalidRetries }),
          "retries must be a positive integer"
        );
      });
    });

    describe("when #defaults.retryDelay is not a a positive integer", () => {
      ["1", -1, "not a number", null].forEach((invalidDelay) => {
        itThrowsInvariant(
          () => fetchBuilder(function () {}, { retryDelay: invalidDelay }),
          "retryDelay must be a positive integer or a function returning a positive integer"
        );
      });
    });

    describe("when #defaults.retryDelay is a function", function () {
      var defaults;
      var retryDelay;

      beforeEach(function () {
        retryDelay = vi.fn().mockReturnValue(5000);
        defaults = {
          retryDelay: retryDelay,
        };

        thenCallback = vi.fn();

        var fetchRetryWithDefaults = fetchBuilder(fetch, defaults);
        fetchRetryWithDefaults("http://someUrl").then(thenCallback);
      });

      // NO TEST HERE
    });

    describe("when #defaults.retryOn is not an array or function", () => {
      itThrowsInvariant(
        () =>
          fetchBuilder(function () {}, {
            retryOn: 503,
          }),
        "retryOn property expects an array or function"
      );
    });

    function whenInitRetriesEquals(n: number) {
      describe(`when #init.retries=${n}`, function () {
        beforeEach(initiateFetchWithInitOptions({ retries: n }));
        describeProperNRetries(n);
      });
    }

    whenInitRetriesEquals(0);
    whenInitRetriesEquals(1);
    whenInitRetriesEquals(2);
    whenInitRetriesEquals(3);

    describe("when #init.retries is not a a positive integer", () => {
      ["1", -1, "not a number", null].forEach((invalidRetries) => {
        itRejectsInvariant(
          () =>
            fetchRetry("http://someurl", { retries: invalidRetries as any }),
          "retries must be a positive integer"
        );
      });
    });
  });

  describe("#init.retryDelay", function () {
    describe("when #init.retryDelay is a number", function () {
      const retryDelay = 5000;

      beforeEach(initiateFetchWithInitOptions({ retryDelay }));

      describe("when first call is unsuccessful", function () {
        beforeEach(rejectDeferred(1));
        beforeEach(advanceTime());

        describe("after specified time", function () {
          beforeEach(advanceTime(retryDelay));
          itHasCalledFetchOnlyNTimes(2);
        });

        describe("after less than specified time", function () {
          beforeEach(advanceTime(1000));
          itHasCalledFetchOnlyNTimes(1);
        });
      });
    });

    describe("when #init.retryDelay is 0", function () {
      beforeEach(initiateFetchWithInitOptions({ retryDelay: 0 }));

      describe("when first call is unsuccessful", function () {
        beforeEach(rejectDeferred(1));
        beforeEach(advanceTime(0));

        itHasCalledFetchOnlyNTimes(1);

        describe("after one event loop tick", function () {
          beforeEach(advanceTime(0));
          itHasCalledFetchOnlyNTimes(2);
        });
      });
    });

    describe("when #init.retryDelay is not a a positive integer", () => {
      ["1", -1, "not a number", null].forEach((invalidDelay) => {
        itRejectsInvariant(
          () =>
            fetchRetry("http://someurl", { retryDelay: invalidDelay as any }),
          "retryDelay must be a positive integer or a function returning a positive integer"
        );
      });
    });

    describe("when #init.retryDelay is a function", function () {
      let retryDelay: Mock<any, number>;

      beforeEach(
        initiateFetchWithInitOptions(() => {
          retryDelay = vi.fn<any, number>().mockReturnValue(5000);
          return { retryDelay };
        })
      );

      function itInvokesTheRetryDelayFunction(n: number, errorMessage: string) {
        it("invokes the retryDelay function", function () {
          expect(retryDelay.mock.calls.length).toBe(n);
          expect(retryDelay.mock.lastCall[0]).toEqual(n - 1);
          expect(retryDelay.mock.lastCall[1].message).toEqual(errorMessage);
        });
      }

      describe("when first call is unsuccessful", function () {
        beforeEach(rejectDeferred(1, new Error("first error")));
        beforeEach(advanceTime());

        describe("when the second call is a success", function () {
          beforeEach(resolveDeferred(2, 200));
          beforeEach(advanceTime(500));
          itInvokesTheRetryDelayFunction(1, "first error");
        });

        describe("when second call is a failure", function () {
          beforeEach(rejectDeferred(2, new Error("second error")));
          beforeEach(advanceTime(5000));

          describe("when the third call is a success", function () {
            beforeEach(resolveDeferred(3, 200));
            beforeEach(advanceTime(5000));
            itInvokesTheRetryDelayFunction(2, "second error");
          });
        });
      });
    });
  });

  describe("#init.retryOn", () => {
    describe("when #init.retryOn is an array", () => {
      beforeEach(initiateFetchWithInitOptions({ retryOn: [503, 404] }));

      describe("when first fetch is resolved with status code specified in retryOn array", () => {
        beforeEach(resolveDeferred(1, 503));
        beforeEach(advanceTime());

        describe("after specified delay", () => {
          beforeEach(advanceTime());
          itHasCalledFetchOnlyNTimes(2);

          describe("when second fetch resolves with a different status code", () => {
            beforeEach(resolveDeferred(2, 200));
            beforeEach(advanceTime());

            describe("when resolved", () => {
              itHasInvokedTheThenCallback();
              itHasCalledFetchOnlyNTimes(2);
            });
          });
        });
      });
    });

    describe("when #init.retryOn is a function", function () {
      let retryOn: Mock<any[], any>;

      beforeEach(
        initiateFetchWithInitOptions(() => {
          retryOn = vi.fn();
          return { retryOn };
        })
      );

      describe("when first attempt is rejected due to network error", function () {
        describe("when #retryOn() returns true", () => {
          beforeEach(() => retryOn.mockReturnValue(true));
          beforeEach(rejectDeferred(1, new Error("first error")));

          describe("when rejected", function () {
            it("invokes #retryOn function with an error", function () {
              expect(retryOn.mock.calls).toEqual([
                [0, new Error("first error"), null],
              ]);
            });

            describe("after specified time", function () {
              beforeEach(advanceTime(delay));
              itHasCalledFetchOnlyNTimes(2);

              describe("when the second call is unsuccessful", function () {
                beforeEach(rejectDeferred(2, new Error("second error")));
                beforeEach(advanceTime(delay));

                describe("when rejected", function () {
                  it("invokes the #retryOn function twice", function () {
                    expect(retryOn.mock.calls).toEqual([
                      [0, new Error("first error"), null],
                      [1, new Error("second error"), null],
                    ]);
                  });
                });
              });
            });
          });
        });

        describe("when #retryOn() returns false", () => {
          beforeEach(() => retryOn.mockReturnValue(false));
          beforeEach(rejectDeferred(1, new Error("first error")));

          describe("when rejected", function () {
            it("invokes #retryOn function with an error", function () {
              expect(retryOn.mock.calls).toEqual([
                [0, new Error("first error"), null],
              ]);
            });

            describe("after specified time", function () {
              beforeEach(advanceTime(delay));
              itHasInvokedTheCatchCallback();
              itHasCalledFetchOnlyNTimes(1);
            });
          });
        });
      });

      describe("when first attempt is resolved", function () {
        describe("when #retryOn() returns true", () => {
          beforeEach(() => retryOn.mockReturnValue(true));
          beforeEach(resolveDeferred(1, 200));
          beforeEach(advanceTime(delay));

          describe("after specified delay", () => {
            beforeEach(advanceTime(delay));
            itHasCalledFetchOnlyNTimes(2);

            describe("when second call is resolved", () => {
              beforeEach(resolveDeferred(2, 200));
              beforeEach(advanceTime(delay));

              it("invokes the #retryOn function with the response", function () {
                expect(retryOn.mock.calls).toEqual([
                  [0, null, { status: 200 }],
                  [1, null, { status: 200 }],
                ]);
              });
            });
          });
        });

        describe("when #retryOn() returns false", () => {
          beforeEach(() => retryOn.mockReturnValue(false));
          beforeEach(resolveDeferred(1, 502));

          describe("when resolved", () => {
            itHasInvokedTheThenCallback();
            itHasCalledFetchOnlyNTimes(1);
          });
        });
      });

      describe("when first attempt is resolved with Promise", function () {
        describe("when #retryOn() returns Promise with true resolve", () => {
          beforeEach(() => retryOn.mockResolvedValue(true));
          beforeEach(resolveDeferred(1, 200));
          beforeEach(advanceTime(delay));

          describe("after specified delay", () => {
            beforeEach(advanceTime(delay));
            

            describe("when second call is resolved", () => {
              itHasCalledFetchOnlyNTimes(2);
              beforeEach(resolveDeferred(2, 200));
              beforeEach(advanceTime());

              it("invokes the #retryOn function with the response", function () {
                expect(retryOn.mock.calls).toEqual([
                  [0, null, { status: 200 }],
                  [1, null, { status: 200 }],
                ]);
              });
            });
          });
        });

        describe("when #retryOn() returns Promise with false resolve", () => {
          beforeEach(() => retryOn.mockResolvedValue(false));
          beforeEach(resolveDeferred(1, 502));
          beforeEach(advanceTime());

          describe("when resolved", () => {
            itHasInvokedTheThenCallback();
            itHasCalledFetchOnlyNTimes(1);
          });
        });

        describe("when #retryOn() throws an error", () => {
          beforeEach(function () {
            retryOn.mockRejectedValue(undefined);
          });

          describe("when rejected", () => {
            beforeEach(rejectDeferred(1));
            beforeEach(advanceTime(0));

            it("retryOn called only once", () => {
              return fetchRetryChain.finally(() => {
                expect(retryOn.mock.calls.length).toBe(1);
              });
            });

            it("invokes the catch callback", function () {
              return fetchRetryChain.finally(() => {
                expect(catchCallback.mock.calls.length).toBe(1);
              });
            });

            itHasCalledFetchOnlyNTimes(1);
          });

          describe("when resolved", () => {
            beforeEach(resolveDeferred(1, 200));

            it("retryOn called only once", () => {
              return fetchRetryChain.finally(() => {
                expect(retryOn.mock.calls.length).toBe(1);
              });
            });

            it("invokes the catch callback", function () {
              return fetchRetryChain.finally(() => {
                expect(catchCallback.mock.calls.length).toBe(1);
              });
            });

            it("called fetch", function () {
              expect(fetch.mock.calls.length).toBe(1);
            });
          });
        });

        describe("when #retryOn() returns a Promise that rejects", () => {
          beforeEach(function () {
            retryOn.mockRejectedValue({});
          });

          describe("when rejected", () => {
            beforeEach(function () {
              deferred1.reject();
            });

            it("retryOn called only once", () => {
              return fetchRetryChain.finally(() => {
                expect(retryOn.mock.calls.length).toBe(1);
              });
            });

            it("invokes the catch callback", function () {
              return fetchRetryChain.finally(() => {
                expect(catchCallback.mock.calls.length).toBe(1);
              });
            });

            it("called fetch", function () {
              expect(fetch.mock.calls.length).toBe(1);
            });
          });
          describe("when resolved", () => {
            beforeEach(function () {
              deferred1.resolve({ status: 200 });
            });

            it("retryOn called only once", () => {
              return fetchRetryChain.finally(() => {
                expect(retryOn.mock.calls.length).toBe(1);
              });
            });

            it("invokes the catch callback", function () {
              return fetchRetryChain.finally(() => {
                expect(catchCallback.mock.calls.length).toBe(1);
              });
            });

            it("called fetch", function () {
              expect(fetch.mock.calls.length).toBe(1);
            });
          });
        });
      });
    });

    describe("when #init.retryOn is not an array or function", function () {
      var init;

      describe("when #init.retryOn is not an array or function", () => {
        it("throws exception", async () => {
          await expect(() =>
            fetchRetry("http://someUrl", { ...init, retryOn: 503 })
          ).rejects.toThrowErrorMatchingInlineSnapshot(
            `[Error: Invariant failed: retryOn property expects an array or function]`
          );
        });
      });
    });
  });
});

function defer() {
  let resolve: (
      value:
        | Response
        | { status: number }
        | PromiseLike<Response | { status: number }>
    ) => void,
    reject: (reason?: any) => void;
  // eslint-disable-next-line no-undef
  let promise = new Promise<Response>(function (lResolve, lReject) {
    resolve = lResolve as any;
    reject = lReject;
  });
  return {
    resolve: resolve!,
    reject: reject!,
    promise: promise,
  };
}
