import {
  trackingPrisma,
} from "../../lib/tracking-prisma.js";

import type {
  InteractionRequestMetadata,
} from "./request-metadata.util.js";

type InteractionSource =
  | "NFC"
  | "QR"
  | "UNKNOWN";

export type RecordInteractionInput = {
  cardId:
    string;

  storeId:
    string;

  businessId:
    string;

  visitorKey:
    string;

  source:
    InteractionSource;

  metadata:
    InteractionRequestMetadata;
};

const DUPLICATE_WINDOW_MS =
  10 *
  1000;

const RETURNING_SESSION_GAP_MS =
  30 *
  60 *
  1000;

/*
 * =========================================================
 * Record interaction
 * =========================================================
 *
 * Important:
 *
 * The transaction is intentionally short.
 *
 * Public tracking must never hold DB
 * resources for a long time.
 */
export async function recordInteraction(
  input:
    RecordInteractionInput
) {
  return trackingPrisma
    .$transaction(
      async (
        tx
      ) => {
        /*
         * Kill unexpectedly slow SQL.
         */
        await tx
          .$executeRaw`
            SET LOCAL statement_timeout = '500ms'
          `;

        /*
         * Don't wait on database locks
         * for public analytics traffic.
         */
        await tx
          .$executeRaw`
            SET LOCAL lock_timeout = '100ms'
          `;

        /*
         * =================================================
         * Per-visitor lock
         * =================================================
         *
         * Without this:
         *
         * Tap A checks duplicate → none
         * Tap B checks duplicate → none
         * Tap A inserts non-duplicate
         * Tap B inserts non-duplicate
         *
         * Both become meaningful interactions.
         *
         * Advisory locking serializes classification for
         * the same visitor/business.
         *
         * Different visitors remain concurrent.
         */
        const resource =
          `visitor:${input.businessId}:${input.visitorKey}`;

        await tx
          .$queryRaw`
            SELECT true AS locked
            FROM pg_advisory_xact_lock(
              hashtextextended(${resource}, 0)
            )
          `;

        const now =
          new Date();

        /*
         * =================================================
         * Duplicate
         * =================================================
         *
         * Same visitor
         * Same physical card
         * Within 10 seconds
         *
         * Ignore bot history when deciding whether a real
         * customer interaction is a duplicate.
         */
        const recent =
          await tx.interaction
            .findFirst({
              where: {
                cardId:
                  input.cardId,

                visitorKey:
                  input.visitorKey,

                isBot:
                  false,

                createdAt: {
                  gte:
                    new Date(
                      now.getTime() -
                        DUPLICATE_WINDOW_MS
                    ),
                },
              },

              select: {
                id:
                  true,
              },

              orderBy: [
                {
                  createdAt:
                    "desc",
                },

                {
                  id:
                    "desc",
                },
              ],
            });

        /*
         * =================================================
         * Previous meaningful visit to this business
         * =================================================
         *
         * Look at the latest meaningful event.
         *
         * This is better than searching for "any event older
         * than 30 minutes", because that could incorrectly
         * classify:
         *
         * yesterday → interaction
         * 5 min ago → interaction
         * now       → interaction
         *
         * as returning despite belonging to the same current
         * session.
         */
        const previous =
          await tx.interaction
            .findFirst({
              where: {
                visitorKey:
                  input.visitorKey,

                isBot:
                  false,

                isDuplicate:
                  false,

                store: {
                  businessId:
                    input.businessId,
                },
              },

              orderBy: [
                {
                  createdAt:
                    "desc",
                },

                {
                  id:
                    "desc",
                },
              ],

              select: {
                createdAt:
                  true,
              },
            });

        const isDuplicate =
          Boolean(
            recent
          );

        const isReturning =
          Boolean(
            previous &&
              now.getTime() -
                previous.createdAt.getTime() >=
                RETURNING_SESSION_GAP_MS
          );

        return tx.interaction
          .create({
            data: {
              cardId:
                input.cardId,

              storeId:
                input.storeId,

              visitorKey:
                input.visitorKey,

              source:
                input.source,

              isDuplicate,

              isReturning,

              isBot:
                input.metadata
                  .isBot,

              deviceType:
                input.metadata
                  .deviceType,

              browser:
                input.metadata
                  .browser,

              operatingSystem:
                input.metadata
                  .operatingSystem,

              language:
                input.metadata
                  .language,

              createdAt:
                now,
            },
          });
      },

      {
        /*
         * Don't wait long just to acquire
         * a Prisma connection.
         */
        maxWait:
          250,

        /*
         * Entire transaction budget.
         */
        timeout:
          750,
      }
    );
}