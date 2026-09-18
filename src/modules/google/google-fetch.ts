import {
    consumeLimit,
  } from "../../middleware/shared-rate-limit.js";
  
  import {
    DomainError,
  } from "../../lib/domain-error.js";
  
  import {
    env,
  } from "../../config/env.js";
  
  /*
   * Every request that can consume
   * Google Places API quota must pass
   * through this function.
   *
   * This gives the entire deployment
   * one shared Redis-backed budget.
   */
  export async function googleFetch(
    url:
      string,
  
    options:
      RequestInit
  ) {
    const retryAfter =
      await consumeLimit(
        "google-upstream",
  
        /*
         * One shared budget for this
         * ValYou deployment.
         */
        "deployment",
  
        env.GOOGLE_API_DAILY_LIMIT,
  
        24 *
          60 *
          60 *
          1000
      );
  
    if (
      retryAfter
    ) {
      throw new DomainError(
        503,
  
        "GOOGLE_BUDGET_EXHAUSTED",
  
        "Google information is temporarily unavailable. Please try later."
      );
    }
  
    try {
      return await fetch(
        url,
        options
      );
    } catch {
      throw new DomainError(
        502,
  
        "GOOGLE_UNAVAILABLE",
  
        "Google information is temporarily unavailable."
      );
    }
  }