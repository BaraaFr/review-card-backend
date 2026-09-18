import type {
    RequestHandler,
  } from "express";
  
  import {
    env,
  } from "../config/env.js";
  
  import {
    DomainError,
  } from "../lib/domain-error.js";
  
  const allowed =
    new Set([
      new URL(
        env.FRONTEND_URL
      ).origin,
  
      new URL(
        env.PUBLIC_API_URL
      ).origin,
    ]);
  
  export const trustedOrigin:
    RequestHandler =
    (
      req,
      _res,
      next
    ) => {
      /*
       * Safe HTTP methods do not
       * mutate server state.
       */
      if (
        [
          "GET",
          "HEAD",
          "OPTIONS",
        ].includes(
          req.method
        )
      ) {
        return next();
      }
  
      const origin =
        req.get(
          "Origin"
        );
  
      if (
        !origin ||
        !allowed.has(
          origin
        )
      ) {
        return next(
          new DomainError(
            403,
            "UNTRUSTED_ORIGIN",
            "This request origin is not allowed."
          )
        );
      }
  
      next();
    };