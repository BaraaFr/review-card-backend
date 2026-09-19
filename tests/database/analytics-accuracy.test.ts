import "dotenv/config";

import test
  from "node:test";

import assert
  from "node:assert/strict";

import {
  randomUUID,
} from "node:crypto";
import { analyticsService, getStoreEngagementPatterns } from "../../src/modules/analytics/analytics.service.js";

const url =
  process.env
    .TEST_DATABASE_URL;

if (
  !url ||
  !new URL(
    url
  ).pathname.endsWith(
    "_test"
  )
) {
  throw new Error(
    "TEST_DATABASE_URL must point to an isolated _test database."
  );
}

process.env.DATABASE_URL =
  url;

process.env.NODE_ENV =
  "test";

process.env.JWT_SECRET ??=
  "test-secret-012345678901234567890123456789";

process.env.ANALYTICS_SALT ??=
  "test-salt-012345678901234567890123456789";

process.env.FRONTEND_URL ??=
  "http://localhost:3000";

process.env.PUBLIC_API_URL ??=
  "http://localhost:4000";

process.env.GOOGLE_PLACES_API_KEY ??=
  "unused-test-key";

const {
  prisma,
} =
  await import(
    "../../src/lib/prisma.js"
  );

const {
  dashboardOverview,
  dashboardTimeline,
} =
  await import(
    "../../src/modules/analytics/dashboard-analytics.service.js"
  );

const {
  analyticsQuerySchema,
} =
  await import(
    "../../src/modules/analytics/analytics.schema.js"
  );

const {
  getStoreEngagementSummary,
  getStoreCardPerformance,
  getLocationPerformance,
} =
  await import(
    "../../src/modules/analytics/analytics.service.js"
  );

const {
  resolveAnalyticsRangeQuery,
} =
  await import(
    "../../src/modules/analytics/utils/analytics-range.util.js"
  );

test(
  "analytics numbers remain accurate across duplicates, bots, stores and Beirut timezone boundaries",

  async () => {
    const suffix =
      randomUUID();

    const owner =
      await prisma.user.create({
        data: {
          name:
            "Analytics owner",

          email:
            `analytics-${suffix}@example.invalid`,

          status:
            "ACTIVE",
        },
      });

    const otherOwner =
      await prisma.user.create({
        data: {
          name:
            "Other owner",

          email:
            `other-${suffix}@example.invalid`,

          status:
            "ACTIVE",
        },
      });

    const business =
      await prisma.business.create({
        data: {
          name:
            "Analytics business",

          ownerId:
            owner.id,
        },
      });

    const [
      storeA,
      storeB,
    ] =
      await Promise.all([
        prisma.store.create({
          data: {
            name:
              "Saida",

            businessId:
              business.id,
          },
        }),

        prisma.store.create({
          data: {
            name:
              "Hamra",

            businessId:
              business.id,
          },
        }),
      ]);

    const [
      cardA,
      cardB,
    ] =
      await Promise.all([
        prisma.card.create({
          data: {
            code:
              randomUUID(),

            status:
              "ACTIVE",

            storeId:
              storeA.id,
          },
        }),

        prisma.card.create({
          data: {
            code:
              randomUUID(),

            status:
              "ACTIVE",

            storeId:
              storeB.id,
          },
        }),
      ]);

    try {
      /*
       * Current period:
       *
       * 2026-09-13 Asia/Beirut
       *
       * midnight Beirut is 2026-09-12T21:00Z
       * during September.
       */

      await prisma.interaction.createMany({
        data: [
          /*
           * Meaningful NFC, visitor A.
           */
          {
            cardId:
              cardA.id,

            storeId:
              storeA.id,

            visitorKey:
              "visitor-a",

            source:
              "NFC",

            createdAt:
              new Date(
                "2026-09-12T21:30:00Z"
              ),
          },

          /*
           * Duplicate A: must NOT count.
           */
          {
            cardId:
              cardA.id,

            storeId:
              storeA.id,

            visitorKey:
              "visitor-a",

            source:
              "NFC",

            isDuplicate:
              true,

            createdAt:
              new Date(
                "2026-09-12T21:31:00Z"
              ),
          },

          /*
           * Bot: must NOT count.
           */
          {
            cardId:
              cardA.id,

            storeId:
              storeA.id,

            visitorKey:
              "bot",

            source:
              "QR",

            isBot:
              true,

            createdAt:
              new Date(
                "2026-09-12T22:00:00Z"
              ),
          },

          /*
           * Meaningful visitor B.
           */
          {
            cardId:
              cardA.id,

            storeId:
              storeA.id,

            visitorKey:
              "visitor-b",

            source:
              "QR",

            createdAt:
              new Date(
                "2026-09-12T23:00:00Z"
              ),
          },

          /*
           * Same visitor A at another branch.
           *
           * Business unique visitors should still
           * remain 2, not 3.
           */
          {
            cardId:
              cardB.id,

            storeId:
              storeB.id,

            visitorKey:
              "visitor-a",

            source:
              "UNKNOWN",

            createdAt:
              new Date(
                "2026-09-13T10:00:00Z"
              ),
          },

          /*
           * Previous-day history for visitor A.
           *
           * Makes visitor A returning.
           */
          {
            cardId:
              cardA.id,

            storeId:
              storeA.id,

            visitorKey:
              "visitor-a",

            source:
              "NFC",

            createdAt:
              new Date(
                "2026-09-12T20:30:00Z"
              ),
          },
        ],
      });

      const query =
        analyticsQuerySchema.parse({
          range:
            "custom",

          from:
            "2026-09-13",

          to:
            "2026-09-13",

          timeZone:
            "Asia/Beirut",

          businessId:
            business.id,
        });

      const actor = {
        id:
          owner.id,

        role:
          "BUSINESS_OWNER" as const,
      };

      const overview =
        await dashboardOverview(
          actor,
          query
        );

      /*
       * 3 meaningful current rows:
       *
       * visitor-a / NFC / Saida
       * visitor-b / QR / Saida
       * visitor-a / UNKNOWN / Hamra
       */
      assert.equal(
        overview.totalInteractions,
        3
      );

      assert.equal(
        overview.previousInteractions,
        1
      );

      assert.equal(
        overview.approximateUniqueVisitors,
        2
      );

      assert.deepEqual(
        overview.source,
        {
          nfc:
            1,

          qr:
            1,

          unknown:
            1,
        }
      );

      /*
       * 3 vs 1 = +200%.
       */
      assert.equal(
        overview.percentageChange,
        200
      );

      const timeline =
        await dashboardTimeline(
          actor,
          query
        );

      assert.deepEqual(
        timeline.timeline,
        [
          {
            date:
              "2026-09-13",

            total:
              3,

            nfc:
              1,

            qr:
              1,

            unknown:
              1,
          },
        ]
      );


      /*
       * Another owner sees nothing.
       */
      const otherOverview =
        await dashboardOverview(
          {
            id:
              otherOwner.id,

            role:
              "BUSINESS_OWNER",
          },

          query
        );

      assert.equal(
        otherOverview.totalInteractions,
        0
      );

      const timelineTotal =
        timeline.timeline.reduce(
          (
            total,
            point
          ) =>
            total +
            point.total,
          0
        );

      assert.equal(
        timelineTotal,
        overview.totalInteractions
      );

      assert.equal(
        overview.source.nfc +
        overview.source.qr +
        overview.source.unknown,

        overview.totalInteractions
      );

      const range =
        resolveAnalyticsRangeQuery({
          preset:
            "custom",

          from:
            "2026-09-13",

          to:
            "2026-09-13",

          timeZone:
            "Asia/Beirut",
        });

      /*
       * Store A has:
       *
       * visitor A
       * visitor B
       *
       * duplicate + bot are excluded.
       */
      const engagement =
        await getStoreEngagementSummary(
          actor,
          storeA.id,
          range
        );

      assert.equal(
        engagement.visitors.new +
        engagement.visitors.returning,

        engagement.visitors.unique
      );

      assert.equal(
        engagement.sources.nfc +
        engagement.sources.qr +
        engagement.sources.unknown,

        engagement.interactions.current
      );

      assert.equal(
        engagement.devices.mobile +
        engagement.devices.tablet +
        engagement.devices.desktop +
        engagement.devices.unknown,

        engagement.interactions.current
      );
      assert.equal(
        engagement.interactions.current,
        2
      );

      assert.equal(
        engagement.interactions.previous,
        1
      );

      assert.equal(
        engagement.visitors.unique,
        2
      );

      assert.equal(
        engagement.visitors.returning,
        1
      );

      assert.equal(
        engagement.visitors.new,
        1
      );

      assert.equal(
        engagement.visitors.returningPercentage,
        50
      );

      assert.equal(
        engagement.visitors.newPercentage,
        50
      );

      assert.equal(
        engagement.sources.nfc,
        1
      );

      assert.equal(
        engagement.sources.qr,
        1
      );

      const cardPerformance =
        await getStoreCardPerformance(
          actor,
          storeA.id,
          range
        );

      assert.equal(
        cardPerformance.summary.totalInteractions,
        2
      );

      assert.equal(
        cardPerformance.summary.totalUniqueVisitors,
        2
      );

      assert.equal(
        cardPerformance.cards[0]
          .duplicateTaps,
        1
      );
      const storeQuery =
        analyticsQuerySchema.parse({
          range:
            "custom",

          from:
            "2026-09-13",

          to:
            "2026-09-13",

          timeZone:
            "Asia/Beirut",

          businessId:
            business.id,

          storeId:
            storeA.id,
        });

      const basicCards =
        await analyticsService.cards(
          actor,
          storeQuery
        );

      assert.equal(
        basicCards.cards.reduce(
          (
            total,
            card
          ) =>
            total +
            card.total,
          0
        ),

        engagement.interactions.current
      );

      const patterns =
        await getStoreEngagementPatterns(
          actor,
          storeA.id,
          range
        );

      assert.equal(
        patterns.summary.totalInteractions,
        engagement.interactions.current
      );

      assert.equal(
        patterns.summary.totalUniqueVisitors,
        engagement.visitors.unique
      );
      /*
       * Whole business:
       *
       * store A = visitors A+B
       * store B = visitor A
       *
       * business unique = A+B = 2
       */
      const locationPerformance =
        await getLocationPerformance(
          actor,
          storeA.id,
          range
        );

      assert.equal(
        locationPerformance.summary.totalInteractions,
        3
      );

      assert.equal(
        locationPerformance.summary.totalUniqueVisitors,
        2
      );

      const locationA =
        locationPerformance.locations.find(
          (
            location
          ) =>
            location.id ===
            storeA.id
        );

      const locationB =
        locationPerformance.locations.find(
          (
            location
          ) =>
            location.id ===
            storeB.id
        );

      assert.equal(
        locationA?.currentInteractions,
        2
      );

      assert.equal(
        locationA?.uniqueVisitors,
        2
      );

      assert.equal(
        locationA?.activityShare,
        66.7
      );

      assert.equal(
        locationB?.currentInteractions,
        1
      );

      assert.equal(
        locationB?.uniqueVisitors,
        1
      );

      assert.equal(
        locationB?.activityShare,
        33.3
      );

      const basicStores =
        await analyticsService.stores(
          actor,
          query
        );

      assert.equal(
        basicStores.stores.reduce(
          (
            total,
            store
          ) =>
            total +
            store.total,
          0
        ),

        overview.totalInteractions
      );

      assert.equal(
        locationPerformance.locations.reduce(
          (
            total,
            location
          ) =>
            total +
            location.currentInteractions,
          0
        ),

        locationPerformance.summary
          .totalInteractions
      );

      const summedLocationUniques =
        locationPerformance.locations.reduce(
          (
            total,
            location
          ) =>
            total +
            location.uniqueVisitors,
          0
        );

      assert.equal(
        summedLocationUniques,
        3
      );

      assert.equal(
        locationPerformance.summary
          .totalUniqueVisitors,
        2
      );

      assert.ok(
        summedLocationUniques >
        locationPerformance.summary
          .totalUniqueVisitors
      );
    } finally {
      await prisma.interaction.deleteMany({
        where: {
          storeId: {
            in: [
              storeA.id,
              storeB.id,
            ],
          },
        },
      });

      await prisma.card.deleteMany({
        where: {
          id: {
            in: [
              cardA.id,
              cardB.id,
            ],
          },
        },
      });

      await prisma.store.deleteMany({
        where: {
          id: {
            in: [
              storeA.id,
              storeB.id,
            ],
          },
        },
      });

      await prisma.business.delete({
        where: {
          id:
            business.id,
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              owner.id,
              otherOwner.id,
            ],
          },
        },
      });

      await prisma
        .$disconnect();
    }
  }
);

test(
  "store unique visitors are distinct across cards and are not the sum of card uniques",

  async () => {
    const suffix =
      randomUUID();

    const owner =
      await prisma.user.create({
        data: {
          name:
            "Multi-card analytics owner",

          email:
            `multi-card-${suffix}@example.invalid`,

          status:
            "ACTIVE",
        },
      });

    const business =
      await prisma.business.create({
        data: {
          name:
            "Multi-card analytics business",

          ownerId:
            owner.id,
        },
      });

    const store =
      await prisma.store.create({
        data: {
          name:
            "Main branch",

          businessId:
            business.id,
        },
      });

    const [
      cardA,
      cardB,
    ] =
      await Promise.all([
        prisma.card.create({
          data: {
            code:
              randomUUID(),

            label:
              "Card A",

            status:
              "ACTIVE",

            storeId:
              store.id,
          },
        }),

        prisma.card.create({
          data: {
            code:
              randomUUID(),

            label:
              "Card B",

            status:
              "ACTIVE",

            storeId:
              store.id,
          },
        }),
      ]);

    try {
      /*
       * Selected local day:
       *
       * 2026-09-13 Asia/Beirut
       *
       * UTC range:
       *
       * >= 2026-09-12T21:00:00Z
       * <  2026-09-13T21:00:00Z
       */
      await prisma.interaction.createMany({
        data: [
          /*
           * Same visitor uses Card A.
           */
          {
            cardId:
              cardA.id,

            storeId:
              store.id,

            visitorKey:
              "same-visitor",

            source:
              "NFC",

            createdAt:
              new Date(
                "2026-09-12T22:00:00Z"
              ),
          },

          /*
           * Same visitor uses Card B.
           *
           * Card-level:
           *
           * Card A unique = 1
           * Card B unique = 1
           *
           * Store-level unique must still = 1.
           */
          {
            cardId:
              cardB.id,

            storeId:
              store.id,

            visitorKey:
              "same-visitor",

            source:
              "QR",

            createdAt:
              new Date(
                "2026-09-12T23:00:00Z"
              ),
          },

          /*
           * Another distinct visitor uses Card B.
           */
          {
            cardId:
              cardB.id,

            storeId:
              store.id,

            visitorKey:
              "second-visitor",

            source:
              "NFC",

            createdAt:
              new Date(
                "2026-09-13T10:00:00Z"
              ),
          },

          /*
           * Duplicate tap from same visitor.
           *
           * Must not affect meaningful interactions
           * or unique visitor counts.
           */
          {
            cardId:
              cardB.id,

            storeId:
              store.id,

            visitorKey:
              "second-visitor",

            source:
              "NFC",

            isDuplicate:
              true,

            createdAt:
              new Date(
                "2026-09-13T10:00:05Z"
              ),
          },

          /*
           * Bot must not count either.
           */
          {
            cardId:
              cardA.id,

            storeId:
              store.id,

            visitorKey:
              "bot-visitor",

            source:
              "QR",

            isBot:
              true,

            createdAt:
              new Date(
                "2026-09-13T11:00:00Z"
              ),
          },
        ],
      });

      const range =
        resolveAnalyticsRangeQuery({
          preset:
            "custom",

          from:
            "2026-09-13",

          to:
            "2026-09-13",

          timeZone:
            "Asia/Beirut",
        });

      /*
       * =====================================================
       * Card-level performance
       * =====================================================
       */
      const actor = {
        id:
          owner.id,
      
        role:
          "BUSINESS_OWNER" as const,
      };

      const cardPerformance =
        await getStoreCardPerformance(
          actor,
          store.id,
          range
        );

      assert.equal(
        cardPerformance.summary
          .totalInteractions,
        3
      );

      /*
       * IMPORTANT:
       *
       * Store distinct visitors:
       *
       * same-visitor
       * second-visitor
       *
       * = 2
       */
      assert.equal(
        cardPerformance.summary
          .totalUniqueVisitors,
        2
      );

      const performanceA =
        cardPerformance.cards.find(
          (
            card
          ) =>
            card.id ===
            cardA.id
        );

      const performanceB =
        cardPerformance.cards.find(
          (
            card
          ) =>
            card.id ===
            cardB.id
        );

      assert.ok(
        performanceA
      );

      assert.ok(
        performanceB
      );

      /*
       * Card A:
       *
       * same-visitor
       *
       * = 1 meaningful interaction
       * = 1 unique visitor
       */
      assert.equal(
        performanceA
          .meaningfulInteractions,
        1
      );

      assert.equal(
        performanceA
          .uniqueVisitors,
        1
      );

      /*
       * Card B:
       *
       * same-visitor
       * second-visitor
       *
       * = 2 meaningful interactions
       * = 2 unique visitors
       */
      assert.equal(
        performanceB
          .meaningfulInteractions,
        2
      );

      assert.equal(
        performanceB
          .uniqueVisitors,
        2
      );

      /*
       * Duplicate tap should be visible only
       * in the duplicate metric.
       */
      assert.equal(
        performanceB
          .duplicateTaps,
        1
      );

      /*
       * =====================================================
       * Critical invariant
       * =====================================================
       *
       * Card unique visitors:
       *
       * Card A = 1
       * Card B = 2
       *
       * Sum = 3
       *
       * But same-visitor exists on both cards.
       *
       * Therefore store unique visitors = 2.
       */

      const summedCardUniqueVisitors =
        cardPerformance.cards.reduce(
          (
            total,
            card
          ) =>
            total +
            card.uniqueVisitors,

          0
        );

      assert.equal(
        summedCardUniqueVisitors,
        3
      );

      assert.equal(
        cardPerformance.summary
          .totalUniqueVisitors,
        2
      );

      assert.ok(
        summedCardUniqueVisitors >
        cardPerformance.summary
          .totalUniqueVisitors
      );

      /*
       * =====================================================
       * Engagement summary must agree
       * =====================================================
       */
     

      const engagement =
        await getStoreEngagementSummary(
          actor,
          store.id,
          range
        );

      assert.equal(
        engagement.interactions.current,
        3
      );

      assert.equal(
        engagement.visitors.unique,
        2
      );

      /*
       * No history exists before this range.
       *
       * Therefore both are new visitors.
       */
      assert.equal(
        engagement.visitors.returning,
        0
      );

      assert.equal(
        engagement.visitors.new,
        2
      );

      assert.equal(
        engagement.visitors.new +
        engagement.visitors.returning,

        engagement.visitors.unique
      );

      /*
       * =====================================================
       * Card totals must equal store total
       * =====================================================
       */

      const summedCardInteractions =
        cardPerformance.cards.reduce(
          (
            total,
            card
          ) =>
            total +
            card.meaningfulInteractions,

          0
        );

      assert.equal(
        summedCardInteractions,
        engagement.interactions.current
      );
    } finally {
      await prisma.interaction.deleteMany({
        where: {
          storeId:
            store.id,
        },
      });

      await prisma.card.deleteMany({
        where: {
          id: {
            in: [
              cardA.id,
              cardB.id,
            ],
          },
        },
      });

      await prisma.store.delete({
        where: {
          id:
            store.id,
        },
      });

      await prisma.business.delete({
        where: {
          id:
            business.id,
        },
      });

      await prisma.user.delete({
        where: {
          id:
            owner.id,
        },
      });
    }
  }
);