import {
    createHmac,
    randomBytes,
  } from "node:crypto";
  
  import type {
    Request,
    Response,
  } from "express";
  
  import {
    env,
  } from "../../config/env.js";
  
  /*
   * =======================================================
   * Anonymous ValYou visitor
   * =======================================================
   *
   * This cookie contains only a random value.
   *
   * It contains NO:
   *
   * - name
   * - phone
   * - email
   * - Google account
   * - location
   * - customer database ID
   *
   * It exists only so ValYou can understand:
   *
   * - unique visitors
   * - returning visitors
   * - duplicate taps
   * =======================================================
   */
  
  export const VALYOU_VISITOR_COOKIE =
    "valyou_visitor";
  
  /*
   * Keep the anonymous identifier
   * for up to one year.
   *
   * Browsers may apply their own
   * cookie retention policies.
   */
  const VISITOR_COOKIE_MAX_AGE_MS =
    365 *
    24 *
    60 *
    60 *
    1000;
  
  /*
   * randomBytes(32).toString("base64url")
   * normally produces ~43 chars.
   *
   * We allow a reasonable range in case
   * the implementation changes later.
   */
  const VALID_VISITOR_TOKEN =
    /^[A-Za-z0-9_-]{32,128}$/;
  
  function createVisitorToken() {
    return randomBytes(
      32
    ).toString(
      "base64url"
    );
  }
  
  function isValidVisitorToken(
    value: unknown
  ): value is string {
    return (
      typeof value ===
        "string" &&
      VALID_VISITOR_TOKEN.test(
        value
      )
    );
  }
  
  /*
   * Store an HMAC in the database
   * rather than the raw cookie value.
   */
  export function createVisitorKey(
    rawVisitorToken: string
  ) {
    return createHmac(
      "sha256",
      env.ANALYTICS_SALT
    )
      .update(
        rawVisitorToken
      )
      .digest(
        "hex"
      );
  }
  
  /*
   * Reads an existing anonymous visitor
   * cookie or creates a new one.
   *
   * Important:
   *
   * Path is /r because JavaScript and
   * authenticated parts of ValYou do not
   * need access to this cookie.
   */
  export function getOrCreateAnonymousVisitor(
    req: Request,
    res: Response
  ) {
    const existing =
      req.cookies?.[
        VALYOU_VISITOR_COOKIE
      ];
  
    if (
      isValidVisitorToken(
        existing
      )
    ) {
      return {
        rawVisitorToken:
          existing,
  
        visitorKey:
          createVisitorKey(
            existing
          ),
  
        isNewCookie:
          false,
      };
    }
  
    const rawVisitorToken =
      createVisitorToken();
  
    res.cookie(
      VALYOU_VISITOR_COOKIE,
      rawVisitorToken,
      {
        httpOnly:
          true,
  
        /*
         * Production HTTPS only.
         */
        secure:
          env.NODE_ENV ===
          "production",
  
        /*
         * Appropriate for a top-level
         * NFC/QR navigation followed
         * by an external redirect.
         */
        sameSite:
          "lax",
  
        /*
         * Only redirect endpoints
         * need this cookie.
         */
        path:
          "/r",
  
        maxAge:
          VISITOR_COOKIE_MAX_AGE_MS,
      }
    );
  
    return {
      rawVisitorToken,
  
      visitorKey:
        createVisitorKey(
          rawVisitorToken
        ),
  
      isNewCookie:
        true,
    };
  }