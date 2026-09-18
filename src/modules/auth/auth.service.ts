import bcrypt
  from "bcryptjs";

import {
  prisma,
} from "../../lib/prisma.js";

import {
  hashActivationToken,
} from "../../utils/activation-token.js";

import type {
  ActivateAccountInput,
  LoginInput,
} from "./auth.schema.js";

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_NOT_ACTIVE"
  | "INVALID_OR_EXPIRED_INVITATION"
  | "ACCOUNT_ALREADY_ACTIVE"
  | "INVITATION_ALREADY_USED";

export class AuthError
  extends Error {
  constructor(
    public readonly code:
      AuthErrorCode
  ) {
    super(
      code
    );
  }
}

const publicUserSelect = {
  id:
    true,

  name:
    true,

  email:
    true,

  role:
    true,

  status:
    true,
} as const;

/*
 * Used when an account doesn't exist
 * or doesn't have a password.
 *
 * We still perform a bcrypt comparison
 * so nonexistent accounts don't have an
 * obviously faster response than existing
 * accounts.
 *
 * This is NOT a real ValYou password.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxuWeyIR3vqZk7kUikmP/X.0u.u";

export const authService = {
  /*
   * =======================================================
   * Login
   * =======================================================
   */
  async login(
    data:
      LoginInput
  ) {
    const email =
      data.email
        .trim()
        .toLowerCase();

    const user =
      await prisma.user
        .findUnique({
          where: {
            email,
          },

          select: {
            ...publicUserSelect,

            passwordHash:
              true,
          },
        });

    /*
     * Always run bcrypt.
     *
     * This reduces observable timing
     * differences between:
     *
     * - nonexistent account
     * - account without password
     * - normal account
     */
    const passwordHash =
      user?.passwordHash ??
      DUMMY_PASSWORD_HASH;

    const passwordMatches =
      await bcrypt.compare(
        data.password,
        passwordHash
      );

    /*
     * Wrong password must remain generic,
     * even if the account exists but is
     * disabled/pending.
     */
    if (
      !user ||
      !user.passwordHash ||
      !passwordMatches
    ) {
      throw new AuthError(
        "INVALID_CREDENTIALS"
      );
    }

    /*
     * Only after password ownership has
     * been proven may we reveal account
     * state.
     */
    if (
      user.status ===
      "DISABLED"
    ) {
      throw new AuthError(
        "ACCOUNT_DISABLED"
      );
    }

    if (
      user.status !==
      "ACTIVE"
    ) {
      throw new AuthError(
        "ACCOUNT_NOT_ACTIVE"
      );
    }

    return {
      id:
        user.id,

      name:
        user.name,

      email:
        user.email,

      role:
        user.role,

      status:
        user.status,
    };
  },

  /*
   * =======================================================
   * Activate account
   * =======================================================
   */
  async activateAccount(
    data:
      ActivateAccountInput
  ) {
    const tokenHash =
      hashActivationToken(
        data.token
      );

    const now =
      new Date();

    const invitation =
      await prisma
        .accountInvitation
        .findFirst({
          where: {
            tokenHash,

            usedAt:
              null,

            expiresAt: {
              gt:
                now,
            },
          },

          include: {
            user: {
              select:
                publicUserSelect,
            },
          },
        });

    if (
      !invitation
    ) {
      throw new AuthError(
        "INVALID_OR_EXPIRED_INVITATION"
      );
    }

    if (
      invitation.user
        .status ===
      "DISABLED"
    ) {
      throw new AuthError(
        "ACCOUNT_DISABLED"
      );
    }

    if (
      invitation.user
        .status ===
      "ACTIVE"
    ) {
      throw new AuthError(
        "ACCOUNT_ALREADY_ACTIVE"
      );
    }

    const passwordHash =
      await bcrypt.hash(
        data.password,
        12
      );

    return prisma
      .$transaction(
        async (
          tx
        ) => {
          /*
           * Atomically claim the invitation.
           *
           * Concurrent activation requests
           * cannot both succeed.
           */
          const claimed =
            await tx
              .accountInvitation
              .updateMany({
                where: {
                  id:
                    invitation.id,

                  tokenHash,

                  usedAt:
                    null,

                  expiresAt: {
                    gt:
                      now,
                  },
                },

                data: {
                  usedAt:
                    now,
                },
              });

          if (
            claimed.count !==
            1
          ) {
            throw new AuthError(
              "INVITATION_ALREADY_USED"
            );
          }

          return tx.user
            .update({
              where: {
                id:
                  invitation
                    .user.id,
              },

              data: {
                passwordHash,

                status:
                  "ACTIVE",
              },

              select:
                publicUserSelect,
            });
        }
      );
  },
};