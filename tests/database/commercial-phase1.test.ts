import "dotenv/config";

import test from "node:test";

import assert from "node:assert/strict";

import {
  randomUUID,
} from "node:crypto";

const url =
  process.env.TEST_DATABASE_URL;

if (
  !url ||
  !new URL(
    url
  ).pathname.endsWith(
    "_test"
  )
) {
  throw new Error(
    "TEST_DATABASE_URL must point to an isolated database whose name ends with _test."
  );
}

/*
 * Force Prisma to use the isolated
 * database for this process.
 */
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
  commercialService:
    service,
} =
  await import(
    "../../src/modules/commercial/commercial.service.js"
  );

test(
  "real PostgreSQL: commercial transactions and tenant boundaries",

  async (
    t
  ) => {
    const actorId =
      `test-${randomUUID()}`;

    const actor = {
      id:
        actorId,

      role:
        "SUPER_ADMIN" as const,
    };

    const context =
      () => ({
        actor,

        key:
          randomUUID(),
      });

    const owners:
      string[] =
      [];

    const businessIds:
      string[] =
      [];

    const cardIds:
      string[] =
      [];

    async function fixture() {
      const owner =
        await prisma.user.create({
          data: {
            name:
              "Test owner",

            email:
              `${randomUUID()}@example.invalid`,

            status:
              "ACTIVE",
          },
        });

      owners.push(
        owner.id
      );

      const business =
        await prisma.business.create({
          data: {
            name:
              "Test business",

            ownerId:
              owner.id,
          },
        });

      businessIds.push(
        business.id
      );

      return {
        owner,
        business,
      };
    }

    const newCard =
      async () => {
        const card =
          await prisma.card.create({
            data: {
              code:
                randomUUID(),

              status:
                "UNASSIGNED",
            },
          });

        cardIds.push(
          card.id
        );

        return card;
      };

    try {
      await t.test(
        "additional business requests replay without duplicates",

        async () => {
          const {
            owner,
          } =
            await fixture();

          const request =
            context();

          const input = {
            name:
              "Additional business",

            subscription: {
              mode:
                "NONE" as const,
            },

            location: {
              name:
                "First location",

              googleReviewUrl:
                "https://g.page/example/review",
            },
          };

          try {
            const results =
              await Promise.all(
                Array.from(
                  {
                    length:
                      5,
                  },

                  () =>
                    service
                      .createAdditionalBusiness(
                        request,
                        owner.id,
                        input
                      )
                )
              );

            results.forEach(
              (
                result
              ) =>
                assert.deepEqual(
                  result,
                  results[0]
                )
            );

            assert.equal(
              await prisma.business.count({
                where: {
                  ownerId:
                    owner.id,
                },
              }),

              2
            );
          } finally {
            const created =
              await prisma.business.findMany({
                where: {
                  ownerId:
                    owner.id,
                },

                select: {
                  id:
                    true,
                },
              });

            for (
              const value
              of created
            ) {
              if (
                !businessIds.includes(
                  value.id
                )
              ) {
                businessIds.push(
                  value.id
                );
              }
            }
          }
        }
      );

      await t.test(
        "parallel requests cannot exceed location limit",

        async () => {
          const {
            business,
          } =
            await fixture();

          const results =
            await Promise.allSettled(
              Array.from(
                {
                  length:
                    5,
                },

                (
                  _,
                  index
                ) =>
                  service
                    .createStore(
                      context(),

                      business.id,

                      {
                        name:
                          `Location ${index}`,
                      }
                    )
              )
            );

          assert.equal(
            results.filter(
              (
                result
              ) =>
                result.status ===
                "fulfilled"
            ).length,

            1
          );

          assert.equal(
            await prisma.store.count({
              where: {
                businessId:
                  business.id,
              },
            }),

            1
          );
        }
      );

      await t.test(
        "idempotency replay works and changed body conflicts",

        async () => {
          const {
            owner,
            business,
          } =
            await fixture();

          const request =
            context();

          const results =
            await Promise.all(
              Array.from(
                {
                  length:
                    5,
                },

                () =>
                  service
                    .createStore(
                      request,

                      business.id,

                      {
                        name:
                          "Repeated location",
                      }
                    )
              )
            );

          results.forEach(
            (
              result
            ) =>
              assert.deepEqual(
                result,
                results[0]
              )
          );

          assert.equal(
            await prisma.store.count({
              where: {
                businessId:
                  business.id,
              },
            }),

            1
          );

          await assert.rejects(
            service.createStore(
              request,

              business.id,

              {
                name:
                  "Changed body",
              }
            ),

            {
              code:
                "IDEMPOTENCY_KEY_REUSED",
            }
          );

          await assert.rejects(
            service.createStore(
              {
                actor: {
                  id:
                    `${owner.id}-other`,

                  role:
                    "BUSINESS_OWNER",
                },

                key:
                  randomUUID(),
              },

              business.id,

              {
                name:
                  "Foreign location",
              }
            ),

            {
              code:
                "BUSINESS_NOT_FOUND",
            }
          );
        }
      );

      await t.test(
        "parallel assignments respect card limits and delivery/trial happen once",

        async () => {
          const {
            business,
          } =
            await fixture();

          const store =
            await prisma.store.create({
              data: {
                name:
                  "Location",

                businessId:
                  business.id,

                googleReviewUrl:
                  "https://g.page/example/review",
              },
            });

          const cards =
            await Promise.all([
              newCard(),
              newCard(),
              newCard(),
            ]);

          const results =
            await Promise.allSettled(
              cards.map(
                (
                  card
                ) =>
                  service.assignCard(
                    context(),

                    card.id,

                    {
                      storeId:
                        store.id,
                    }
                  )
              )
            );

          assert.equal(
            results.filter(
              (
                result
              ) =>
                result.status ===
                "fulfilled"
            ).length,

            2
          );

          const card =
            await prisma.card
              .findFirstOrThrow({
                where: {
                  storeId:
                    store.id,
                },
              });

          const deliveryContext =
            context();

          const input = {
            paymentMethod:
              "CASH" as const,

            receiptReference:
              randomUUID()
                .toUpperCase(),
          };

          await Promise.all(
            Array.from(
              {
                length:
                  5,
              },

              () =>
                service.deliverCard(
                  deliveryContext,

                  card.id,

                  input
                )
            )
          );

          assert.equal(
            await prisma.paymentRecord.count({
              where: {
                cardId:
                  card.id,
              },
            }),

            1
          );

          await assert.rejects(
            service.deliverCard(
              context(),

              card.id,

              {
                ...input,

                receiptReference:
                  randomUUID(),
              }
            ),

            {
              code:
                "CARD_ALREADY_DELIVERED",
            }
          );

          const trialContext =
            context();

          await Promise.all(
            Array.from(
              {
                length:
                  5,
              },

              () =>
                service.startTrial(
                  trialContext,

                  business.id
                )
            )
          );

          assert.equal(
            await prisma.subscription.count({
              where: {
                businessId:
                  business.id,

                status:
                  "TRIAL",
              },
            }),

            1
          );

          await assert.rejects(
            service.startTrial(
              context(),

              business.id
            ),

            {
              code:
                "TRIAL_ALREADY_USED",
            }
          );
        }
      );

      await t.test(
        "renewals replay, duplicate receipts reject and failed payments roll back",

        async () => {
          const {
            business,
          } =
            await fixture();

          const expiry =
            new Date();

          expiry.setUTCFullYear(
            expiry.getUTCFullYear() +
              1
          );

          expiry.setUTCDate(
            15
          );

          const subscription =
            await prisma.subscription.create({
              data: {
                businessId:
                  business.id,

                plan:
                  "STARTER",

                status:
                  "ACTIVE",

                startsAt:
                  new Date(
                    "2020-01-01"
                  ),

                expiresAt:
                  expiry,
              },
            });

          const input = {
            plan:
              "STARTER" as const,

            months:
              1,

            amountCents:
              450,

            paymentMethod:
              "CASH" as const,

            receiptReference:
              randomUUID()
                .toUpperCase(),
          };

          const request =
            context();

          await Promise.all(
            Array.from(
              {
                length:
                  5,
              },

              () =>
                service.activatePaid(
                  request,

                  business.id,

                  input
                )
            )
          );

          const expected =
            new Date(
              expiry
            );

          expected.setUTCMonth(
            expected.getUTCMonth() +
              1
          );

          assert.equal(
            (
              await prisma.subscription
                .findUniqueOrThrow({
                  where: {
                    id:
                      subscription.id,
                  },
                })
            ).expiresAt!
              .toISOString(),

            expected
              .toISOString()
          );

          assert.equal(
            await prisma.paymentRecord.count({
              where: {
                businessId:
                  business.id,
              },
            }),

            1
          );

          await assert.rejects(
            service.activatePaid(
              context(),

              business.id,

              input
            ),

            {
              code:
                "PAYMENT_ALREADY_RECORDED",
            }
          );

          await Promise.all(
            [
              1,
              2,
            ].map(
              () =>
                service.activatePaid(
                  context(),

                  business.id,

                  {
                    ...input,

                    receiptReference:
                      randomUUID()
                        .toUpperCase(),
                  }
                )
            )
          );

          expected.setUTCMonth(
            expected.getUTCMonth() +
              2
          );

          assert.equal(
            (
              await prisma.subscription
                .findUniqueOrThrow({
                  where: {
                    id:
                      subscription.id,
                  },
                })
            ).expiresAt!
              .toISOString(),

            expected
              .toISOString()
          );

          /*
           * amountCents = 0 violates
           * the database payment
           * invariant and the entire
           * transaction must roll back.
           */
          const failedRequest =
            context();

          await assert.rejects(
            service.activatePaid(
              failedRequest,

              business.id,

              {
                ...input,

                amountCents:
                  0,

                receiptReference:
                  randomUUID(),
              }
            )
          );

          assert.equal(
            (
              await prisma.subscription
                .findUniqueOrThrow({
                  where: {
                    id:
                      subscription.id,
                  },
                })
            ).expiresAt!
              .toISOString(),

            expected
              .toISOString()
          );

          /*
           * A failed transaction must not
           * leave a completed idempotency
           * record behind.
           */
          assert.equal(
            await prisma.idempotencyRecord.count({
              where: {
                actorId,

                key:
                  failedRequest
                    .key,
              },
            }),

            0
          );
        }
      );
    } finally {
      await prisma.interaction.deleteMany({
        where: {
          store: {
            businessId: {
              in:
                businessIds,
            },
          },
        },
      });

      await prisma.card.deleteMany({
        where: {
          id: {
            in:
              cardIds,
          },
        },
      });

      await prisma.store.deleteMany({
        where: {
          businessId: {
            in:
              businessIds,
          },
        },
      });

      await prisma.subscription.deleteMany({
        where: {
          businessId: {
            in:
              businessIds,
          },
        },
      });

      await prisma.paymentRecord.deleteMany({
        where: {
          businessId: {
            in:
              businessIds,
          },
        },
      });

      await prisma.business.deleteMany({
        where: {
          id: {
            in:
              businessIds,
          },
        },
      });

      await prisma.user.deleteMany({
        where: {
          id: {
            in:
              owners,
          },
        },
      });

      await prisma.auditEvent.deleteMany({
        where: {
          actorId,
        },
      });

      await prisma.idempotencyRecord.deleteMany({
        where: {
          actorId,
        },
      });

      await prisma
        .$disconnect();
    }
  }
);