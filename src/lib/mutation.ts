import { createHash } from "node:crypto";

import type {
  Prisma,
} from "../../generated/prisma/client.js";

import {
  prisma,
} from "./prisma.js";

import {
  DomainError,
} from "./domain-error.js";

export type Tx =
  Prisma.TransactionClient;

export type Actor = {
  id: string;

  role:
    | "SUPER_ADMIN"
    | "BUSINESS_OWNER";
};

export type MutationContext = {
  actor: Actor;

  key: string;
};

export function canonicalJson(
  value: unknown
): string {
  if (value instanceof Date) {
    return JSON.stringify(
      value.toISOString()
    );
  }

  if (value === undefined) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value
      .map(canonicalJson)
      .join(",")}]`;
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return `{${Object.entries(value)
      .filter(
        ([, v]) =>
          v !== undefined
      )
      .sort(
        ([a], [b]) =>
          a.localeCompare(b)
      )
      .map(
        ([k, v]) =>
          `${JSON.stringify(k)}:${canonicalJson(v)}`
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export async function lock(
  tx: Tx,
  resource: string
) {
  await tx.$queryRaw`
    SELECT true AS locked
    FROM pg_advisory_xact_lock(
      hashtextextended(${resource}, 0)
    )
  `;
}

export async function serializable<T>(
  work: (
    tx: Tx
  ) => Promise<T>
): Promise<T> {
  for (
    let attempt = 0;
    attempt < 5;
    attempt++
  ) {
    try {
      return await prisma.$transaction(
        work,
        {
          isolationLevel:
            "Serializable",

          maxWait:
            5000,

          timeout:
            10000,
        }
      );
    } catch (error) {
      const code =
        (
          error as {
            code?: string;
          }
        ).code;

      const sqlState =
        (
          error as {
            meta?: {
              code?: string;
            };
          }
        ).meta?.code;

      if (
        code !== "P2034" &&
        sqlState !== "40001" &&
        sqlState !== "40P01"
      ) {
        throw error;
      }

      if (attempt === 4) {
        throw new DomainError(
          503,
          "TRANSACTION_BUSY",
          "Please retry this request."
        );
      }

      await new Promise(
        (
          resolve
        ) =>
          setTimeout(
            resolve,
            25 *
              2 ** attempt +
              Math.random() *
                30
          )
      );
    }
  }

  throw new Error(
    "Unreachable transaction state"
  );
}

export async function mutate(
  context: MutationContext,
  operation: string,
  target: string,
  input: unknown,
  work: (
    tx: Tx
  ) => Promise<unknown>
) {
  if (
    !/^[a-zA-Z0-9_-]{16,100}$/.test(
      context.key
    )
  ) {
    throw new DomainError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "Supply a valid Idempotency-Key header."
    );
  }

  const requestHash =
    createHash("sha256")
      .update(
        canonicalJson({
          operation,
          target,
          input,
        })
      )
      .digest("hex");

  /*
   * Persist the result and business writes
   * together.
   */
  for (
    let collision = 0;
    collision < 3;
    collision++
  ) {
    try {
      return await serializable(
        async (
          tx
        ) => {
          await lock(
            tx,
            `request:${context.actor.id}:${context.key}`
          );

          const existing =
            await tx.idempotencyRecord.findUnique(
              {
                where: {
                  actorId_key: {
                    actorId:
                      context
                        .actor.id,

                    key:
                      context.key,
                  },
                },
              }
            );

          if (existing) {
            if (
              existing.requestHash !==
              requestHash
            ) {
              throw new DomainError(
                409,
                "IDEMPOTENCY_KEY_REUSED",
                "This request ID was used for different data."
              );
            }

            return existing.response;
          }

          const response =
            JSON.parse(
              JSON.stringify(
                await work(tx)
              )
            ) as Prisma.InputJsonValue;

          await tx.auditEvent.create({
            data: {
              actorId:
                context.actor.id,

              operation,

              target,

              details:
                JSON.parse(
                  canonicalJson({
                    input,
                    response,
                  })
                ) as Prisma.InputJsonValue,
            },
          });

          await tx.idempotencyRecord.create({
            data: {
              actorId:
                context.actor.id,

              key:
                context.key,

              requestHash,

              response,
            },
          });

          return response;
        }
      );
    } catch (error) {
      if (
        (
          error as {
            code?: string;
          }
        ).code !==
          "P2002" ||
        collision === 2
      ) {
        throw error;
      }
    }
  }

  throw new Error(
    "Unreachable idempotency state"
  );
}