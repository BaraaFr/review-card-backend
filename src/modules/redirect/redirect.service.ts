import {
  prisma,
} from "../../lib/prisma.js";

import {
  isSubscriptionUsable,
} from "../../utils/subscription.js";
import {
  validateGoogleUrl,
} from "../google/google-url.util.js";
/*
 * =======================================================
 * Redirect context
 * =======================================================
 *
 * This function determines whether this physical
 * ValYou card can redirect and where it should go.
 *
 * IMPORTANT:
 *
 * Card.status and subscription availability are
 * intentionally separate concepts.
 *
 * We NEVER modify the physical Card.status because
 * a subscription expired.
 *
 * This means that after renewal the same physical
 * NFC/QR card automatically works again.
 * =======================================================
 */

export async function getCardRedirectContext(
  code:
    string
) {
  const card =
    await prisma.card.findUnique({
      where: {
        code,
      },

      select: {
        id:
          true,

        code:
          true,

        status:
          true,

        store: {
          select: {
            id:
              true,

            businessId:
              true,

            googleReviewUrl:
              true,

            business: {
              select: {
                subscriptions: {
                  orderBy: {
                    createdAt:
                      "desc",
                  },

                  take:
                    1,

                  select: {
                    status:
                      true,

                    startsAt: true,

                    expiresAt:
                      true,
                  },
                },
              },
            },
          },
        },
      },
    });

  /*
   * =====================================================
   * Card exists
   * =====================================================
   */

  if (
    !card
  ) {
    throw new Error(
      "CARD_NOT_FOUND"
    );
  }

  /*
   * =====================================================
   * Physical card status
   * =====================================================
   */

  if (
    card.status !==
    "ACTIVE"
  ) {
    throw new Error(
      "CARD_NOT_ACTIVE"
    );
  }

  /*
   * =====================================================
   * Card assignment
   * =====================================================
   */

  if (
    !card.store
  ) {
    throw new Error(
      "CARD_NOT_ASSIGNED"
    );
  }

  /*
   * =====================================================
   * Subscription
   * =====================================================
   *
   * The newest subscription represents the
   * current subscription state for this business.
   *
   * No subscription:
   *   blocked
   *
   * EXPIRED:
   *   blocked
   *
   * CANCELED:
   *   blocked
   *
   * PAST_DUE:
   *   blocked
   *
   * ACTIVE/TRIAL + valid expiration:
   *   allowed
   */

  const subscription =
    card.store.business
      .subscriptions[0] ??
    null;

  if (
    !isSubscriptionUsable(
      subscription
    )
  ) {
    throw new Error(
      "SUBSCRIPTION_UNAVAILABLE"
    );
  }

  /*
   * =====================================================
   * Google review URL
   * =====================================================
   */

  if (
    !card.store.googleReviewUrl
  ) {
    throw new Error(
      "GOOGLE_REVIEW_URL_MISSING"
    );
  }

  /*
   * Defensive URL validation.
   *
   * Store API should already validate it,
   * but the public redirect should never
   * blindly trust database values.
   */

  const reviewUrl =
    validateGoogleUrl(
      card.store.googleReviewUrl
    );

  /*
   * Only a completely valid card gets
   * this far.
   *
   * The controller will then record the
   * interaction and redirect to Google.
   */

  return {
    cardId:
      card.id,

    storeId:
      card.store.id,

    businessId:
      card.store.businessId,

    googleReviewUrl:
      reviewUrl.toString(),
  };
}