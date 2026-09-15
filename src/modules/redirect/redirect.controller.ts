import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  getCardRedirectContext,
} from "./redirect.service.js";

import {
  getOrCreateAnonymousVisitor,
} from "../interactions/anonymous-visitor.util.js";

import {
  getInteractionRequestMetadata,
} from "../interactions/request-metadata.util.js";

import {
  recordInteraction,
} from "../interactions/interaction-tracking.service.js";
import { env } from "../../config/env.js";

type InteractionSource =
  | "NFC"
  | "QR"
  | "UNKNOWN";

/*
 * =======================================================
 * Source normalization
 * =======================================================
 *
 * Supported physical URLs:
 *
 * /r/CODE?source=nfc
 *
 * /r/CODE?source=qr
 * =======================================================
 */

function getInteractionSource(
  value: unknown
): InteractionSource {
  if (
    typeof value !==
    "string"
  ) {
    return "UNKNOWN";
  }

  const source =
    value
      .trim()
      .toLowerCase();

  if (
    source ===
    "nfc"
  ) {
    return "NFC";
  }

  if (
    source ===
    "qr"
  ) {
    return "QR";
  }

  return "UNKNOWN";
}

/*
 * =======================================================
 * GET /r/:code
 * =======================================================
 */

export async function redirectCardController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    /*
     * First resolve the destination.
     *
     * We need this BEFORE analytics.
     *
     * If analytics later fail,
     * the customer must still reach
     * Google.
     */
    const redirectContext =
      await getCardRedirectContext(
        req.params.code as string
      );

    /*
     * Create/reuse anonymous first-party
     * visitor identifier.
     */
    const visitor =
      getOrCreateAnonymousVisitor(
        req,
        res
      );

    /*
     * Collect coarse device/browser
     * information.
     */
    const metadata =
      getInteractionRequestMetadata(
        req
      );

    const source =
      getInteractionSource(
        req.query.source
      );

    /*
     * ---------------------------------------------------
     * IMPORTANT
     * ---------------------------------------------------
     *
     * Analytics are secondary.
     *
     * If the database interaction insert
     * fails, DO NOT prevent the customer
     * from reaching Google.
     *
     * We await it because it improves
     * reliability compared with a
     * fire-and-forget promise, but any
     * error is swallowed after logging.
     */
    try {
      await recordInteraction({
        cardId:
          redirectContext.cardId,

        storeId:
          redirectContext.storeId,

        businessId:
          redirectContext.businessId,

        visitorKey:
          visitor.visitorKey,

        source,

        metadata,
      });
    } catch (trackingError) {
      console.error(
        "ValYou interaction tracking failed:",
        trackingError
      );
    }

    /*
     * Do NOT cache the redirect.
     *
     * Otherwise a browser/proxy could
     * skip ValYou on future taps and
     * go directly to Google, which would
     * cause lost analytics.
     */
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    res.setHeader(
      "Expires",
      "0"
    );

    return res.redirect(
      302,
      redirectContext.googleReviewUrl
    );
  } catch (error) {
    /*
     * Public card errors.
     */

    if (
      error instanceof
      Error
    ) {
      switch (
      error.message
      ) {
        case "CARD_NOT_FOUND":
          return res
            .status(404)
            .send(
              "ValYou card not found."
            );

        case "CARD_NOT_ACTIVE":
          return res
            .status(410)
            .send(
              "This ValYou card is currently inactive."
            );

        case "CARD_NOT_ASSIGNED":
          return res
            .status(410)
            .send(
              "This ValYou card is not currently assigned."
            );

        case "SUBSCRIPTION_UNAVAILABLE": {
              /*
               * Do not allow browsers/proxies
               * to cache this redirect.
               *
               * After the owner renews,
               * the same card must work again
               * immediately.
               */
              res.setHeader(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, proxy-revalidate"
              );
    
              res.setHeader(
                "Pragma",
                "no-cache"
              );
    
              res.setHeader(
                "Expires",
                "0"
              );
    
              /*
               * Never expose billing information
               * to the restaurant's customer.
               */
              return res.redirect(
                302,
                `${env.FRONTEND_URL}/review-unavailable`
              );
            }

        case "GOOGLE_REVIEW_URL_MISSING":
          return res
            .status(503)
            .send(
              "The review page for this location is temporarily unavailable."
            );

        case "INVALID_GOOGLE_REVIEW_URL":
          return res
            .status(503)
            .send(
              "The review page for this location is temporarily unavailable."
            );
      }
    }

    return next(
      error
    );
  }
}