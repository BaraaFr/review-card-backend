import {
  prisma,
} from "../../lib/prisma.js";

/*
 * =======================================================
 * Redirect context
 * =======================================================
 *
 * This function's only responsibility
 * is determining whether this physical
 * ValYou card can redirect and where
 * it should redirect.
 * =======================================================
 */

export async function getCardRedirectContext(
  code: string
) {
  const card =
    await prisma.card.findUnique({
      where: {
        code,
      },

      select: {
        id: true,

        code: true,

        status: true,

        store: {
          select: {
            id: true,

            businessId:
              true,

            googleReviewUrl:
              true,
          },
        },
      },
    });

  if (!card) {
    throw new Error(
      "CARD_NOT_FOUND"
    );
  }

  /*
   * Only physically active cards
   * should redirect.
   */
  if (
    card.status !==
    "ACTIVE"
  ) {
    throw new Error(
      "CARD_NOT_ACTIVE"
    );
  }

  if (!card.store) {
    throw new Error(
      "CARD_NOT_ASSIGNED"
    );
  }

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
   * The Store API should already
   * validate this when the URL is saved,
   * but public redirect code should not
   * blindly trust database values.
   */
  let reviewUrl: URL;

  try {
    reviewUrl =
      new URL(
        card.store
          .googleReviewUrl
      );
  } catch {
    throw new Error(
      "INVALID_GOOGLE_REVIEW_URL"
    );
  }

  if (
    reviewUrl.protocol !==
      "https:" &&
    reviewUrl.protocol !==
      "http:"
  ) {
    throw new Error(
      "INVALID_GOOGLE_REVIEW_URL"
    );
  }

  return {
    cardId:
      card.id,

    storeId:
      card.store.id,

    businessId:
      card.store
        .businessId,

    googleReviewUrl:
      reviewUrl.toString(),
  };
}