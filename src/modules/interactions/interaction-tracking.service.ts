import {
    prisma,
  } from "../../lib/prisma.js";
  
  import type {
    InteractionRequestMetadata,
  } from "./request-metadata.util.js";
  
  type InteractionSource =
    | "NFC"
    | "QR"
    | "UNKNOWN";
  
  /*
   * =======================================================
   * Duplicate window
   * =======================================================
   *
   * If the same anonymous visitor taps
   * the same physical card more than once
   * within 10 seconds:
   *
   * first tap
   * isDuplicate = false
   *
   * second tap
   * isDuplicate = true
   *
   * We still store both events.
   *
   * Dashboard analytics can exclude
   * duplicates.
   * =======================================================
   */
  
  const DUPLICATE_WINDOW_MS =
    10 *
    1000;
  
  /*
   * =======================================================
   * Returning visitor definition
   * =======================================================
   *
   * We do NOT consider:
   *
   * tap
   * wait 15 seconds
   * tap again
   *
   * a "returning customer".
   *
   * A returning session requires at least
   * 30 minutes since the previous session.
   *
   * Later we can adjust this business rule.
   * =======================================================
   */
  
  const RETURNING_SESSION_GAP_MS =
    30 *
    60 *
    1000;
  
  type RecordInteractionInput = {
    cardId: string;
  
    storeId: string;
  
    businessId: string;
  
    visitorKey: string;
  
    source:
      InteractionSource;
  
    metadata:
      InteractionRequestMetadata;
  };
  
  export async function recordInteraction(
    input:
      RecordInteractionInput
  ) {
    const now =
      new Date();
  
    const duplicateSince =
      new Date(
        now.getTime() -
          DUPLICATE_WINDOW_MS
      );
  
    const returningBefore =
      new Date(
        now.getTime() -
          RETURNING_SESSION_GAP_MS
      );
  
    /*
     * We deliberately run both
     * lookups in parallel to reduce
     * redirect latency.
     */
    const [
      recentSameCardInteraction,
      historicalBusinessInteraction,
    ] =
      await Promise.all([
        /*
         * Duplicate:
         *
         * same anonymous visitor
         * + same physical card
         * + within 10 seconds
         */
        prisma.interaction.findFirst({
          where: {
            cardId:
              input.cardId,
  
            visitorKey:
              input.visitorKey,
  
            createdAt: {
              gte:
                duplicateSince,
            },
          },
  
          select: {
            id: true,
          },
  
          orderBy: {
            createdAt:
              "desc",
          },
        }),
  
        /*
         * Returning visitor:
         *
         * same visitor
         * + same BUSINESS
         * + previous meaningful event
         * + older than 30 minutes
         *
         * Important:
         *
         * Visiting Business A must NOT
         * make the visitor "returning"
         * when they later visit Business B.
         */
        prisma.interaction.findFirst({
          where: {
            visitorKey:
              input.visitorKey,
  
            isDuplicate:
              false,
  
            isBot:
              false,
  
            createdAt: {
              lt:
                returningBefore,
            },
  
            store: {
              businessId:
                input.businessId,
            },
          },
  
          select: {
            id: true,
          },
  
          orderBy: {
            createdAt:
              "desc",
          },
        }),
      ]);
  
    const isDuplicate =
      Boolean(
        recentSameCardInteraction
      );
  
    const isReturning =
      Boolean(
        historicalBusinessInteraction
      );
  
    const interaction =
      await prisma.interaction.create({
        data: {
          cardId:
            input.cardId,
  
          storeId:
            input.storeId,
  
          source:
            input.source,
  
          visitorKey:
            input.visitorKey,
  
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
  
    return interaction;
  }