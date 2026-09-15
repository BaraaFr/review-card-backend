import {
    createHash,
    randomBytes,
  } from "node:crypto";
  
  import bcrypt from "bcryptjs";
  
  import {
    prisma,
  } from "../../lib/prisma.js";
  
  import {
    env,
  } from "../../config/env.js";
  
  import {
    sendEmail,
  } from "../../lib/mailer.js";
  
  import type {
    ForgotPasswordInput,
    ResetPasswordInput,
  } from "./auth.schema.js";
  
  /*
   * =========================================================
   * Configuration
   * =========================================================
   */
  
  const RESET_TOKEN_TTL_MS =
    30 *
    60 *
    1000;
  
  /*
   * =========================================================
   * Error
   * =========================================================
   */
  
  export type PasswordResetErrorCode =
    | "INVALID_OR_EXPIRED_PASSWORD_RESET"
    | "PASSWORD_NOT_CHANGED";
  
  export class PasswordResetError extends Error {
    constructor(
      public readonly code:
        PasswordResetErrorCode
    ) {
      super(
        code
      );
    }
  }
  
  /*
   * =========================================================
   * Token helpers
   * =========================================================
   */
  
  function generatePasswordResetToken() {
    return randomBytes(
      32
    ).toString(
      "hex"
    );
  }
  
  function hashPasswordResetToken(
    token: string
  ) {
    return createHash(
      "sha256"
    )
      .update(
        token
      )
      .digest(
        "hex"
      );
  }
  
  /*
   * =========================================================
   * Email safety
   * =========================================================
   */
  
  function escapeHtml(
    value: string
  ) {
    return value
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );
  }
  
  /*
   * =========================================================
   * Email
   * =========================================================
   */
  
  async function sendPasswordResetEmail({
    email,
    name,
    rawToken,
  }: {
    email:
      string;
  
    name:
      string;
  
    rawToken:
      string;
  }) {
    const resetUrl =
      `${env.FRONTEND_URL}` +
      `/reset-password?token=${encodeURIComponent(
        rawToken
      )}`;
  
    const safeName =
      escapeHtml(
        name
      );
  
    const safeUrl =
      escapeHtml(
        resetUrl
      );
  
    const subject =
      "Reset your ValYou password";
  
    const text =
      [
        `Hi ${name},`,
        "",
        "We received a request to reset the password for your ValYou account.",
        "",
        "Reset your password using this link:",
        resetUrl,
        "",
        "This link expires in 30 minutes.",
        "",
        "If you didn't request this password reset, you can safely ignore this email.",
        "",
        "ValYou",
      ].join(
        "\n"
      );
  
    const html =
      `
        <div
          style="
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.6;
            color: #18181b;
            max-width: 560px;
            margin: 0 auto;
            padding: 32px 20px;
          "
        >
          <div
            style="
              font-size: 22px;
              font-weight: 700;
              margin-bottom: 28px;
            "
          >
            ValYou
          </div>
  
          <h1
            style="
              font-size: 24px;
              line-height: 1.3;
              margin: 0 0 16px;
            "
          >
            Reset your password
          </h1>
  
          <p>
            Hi ${safeName},
          </p>
  
          <p>
            We received a request to reset the password
            for your ValYou account.
          </p>
  
          <div
            style="
              margin: 28px 0;
            "
          >
            <a
              href="${safeUrl}"
              style="
                display: inline-block;
                background: #10b981;
                color: #ffffff;
                text-decoration: none;
                font-weight: 600;
                padding: 12px 20px;
                border-radius: 10px;
              "
            >
              Reset password
            </a>
          </div>
  
          <p
            style="
              color: #71717a;
              font-size: 14px;
            "
          >
            This link expires in 30 minutes.
          </p>
  
          <p
            style="
              color: #71717a;
              font-size: 14px;
            "
          >
            If you didn't request this password reset,
            you can safely ignore this email.
          </p>
  
          <hr
            style="
              border: 0;
              border-top: 1px solid #e4e4e7;
              margin: 28px 0;
            "
          />
  
          <p
            style="
              color: #a1a1aa;
              font-size: 12px;
            "
          >
            ValYou — Review intelligence
          </p>
        </div>
      `;
  
    await sendEmail({
      to:
        email,
  
      subject,
  
      text,
  
      html,
    });
  }
  
  /*
   * =========================================================
   * Service
   * =========================================================
   */
  
  export const passwordResetService = {
    /*
     * =======================================================
     * Request reset
     * =======================================================
     *
     * IMPORTANT:
     *
     * The caller must receive the same response whether
     * the email exists or not.
     *
     * Only ACTIVE users with an existing password receive
     * the actual email.
     */
  
    async requestPasswordReset(
      input:
        ForgotPasswordInput
    ) {
      const email =
        input.email
          .trim()
          .toLowerCase();
  
      const user =
        await prisma.user.findUnique({
          where: {
            email,
          },
  
          select: {
            id:
              true,
  
            name:
              true,
  
            email:
              true,
  
            status:
              true,
  
            passwordHash:
              true,
          },
        });
  
      /*
       * Do NOT reveal:
       *
       * - user doesn't exist
       * - pending account
       * - disabled account
       * - account has no password
       */
  
      if (
        !user ||
        user.status !==
          "ACTIVE" ||
        !user.passwordHash
      ) {
        return;
      }
  
      const rawToken =
        generatePasswordResetToken();
  
      const tokenHash =
        hashPasswordResetToken(
          rawToken
        );
  
      const expiresAt =
        new Date(
          Date.now() +
            RESET_TOKEN_TTL_MS
        );
  
      /*
       * One token per user.
       *
       * Asking for another link immediately makes
       * the previous link invalid.
       */
  
      await prisma.passwordResetToken.upsert({
        where: {
          userId:
            user.id,
        },
  
        create: {
          userId:
            user.id,
  
          tokenHash,
  
          expiresAt,
  
          usedAt:
            null,
        },
  
        update: {
          tokenHash,
  
          expiresAt,
  
          usedAt:
            null,
        },
      });
  
      try {
        await sendPasswordResetEmail({
          email:
            user.email,
  
          name:
            user.name,
  
          rawToken,
        });
      } catch (
        error
      ) {
        /*
         * Don't leave behind a valid token if
         * the email could not be delivered.
         */
  
        await prisma.passwordResetToken.deleteMany({
          where: {
            userId:
              user.id,
  
            tokenHash,
          },
        });
  
        console.error(
          "Password reset email delivery failed",
          {
            userId:
              user.id,
  
            error,
          }
        );
  
        /*
         * Still do not reveal account existence
         * through the public API response.
         */
      }
    },
  
    /*
     * =======================================================
     * Reset password
     * =======================================================
     */
  
    async resetPassword(
      input:
        ResetPasswordInput
    ) {
      const tokenHash =
        hashPasswordResetToken(
          input.token
        );
  
      const now =
        new Date();
  
      const resetToken =
        await prisma.passwordResetToken.findFirst({
          where: {
            tokenHash,
  
            usedAt:
              null,
  
            expiresAt: {
              gt:
                now,
            },
          },
  
          select: {
            id:
              true,
  
            tokenHash:
              true,
  
            expiresAt:
              true,
  
            user: {
              select: {
                id:
                  true,
  
                status:
                  true,
  
                passwordHash:
                  true,
              },
            },
          },
        });
  
      /*
       * Treat all of these identically:
       *
       * - unknown token
       * - expired token
       * - used token
       * - disabled account
       * - pending account
       */
  
      if (
        !resetToken ||
        resetToken.user.status !==
          "ACTIVE" ||
        !resetToken.user.passwordHash
      ) {
        throw new PasswordResetError(
          "INVALID_OR_EXPIRED_PASSWORD_RESET"
        );
      }
  
      /*
       * Don't allow "resetting" to the same password.
       */
  
      const sameAsCurrent =
        await bcrypt.compare(
          input.password,
          resetToken.user
            .passwordHash
        );
  
      if (
        sameAsCurrent
      ) {
        throw new PasswordResetError(
          "PASSWORD_NOT_CHANGED"
        );
      }
  
      const newPasswordHash =
        await bcrypt.hash(
          input.password,
          12
        );
  
      await prisma.$transaction(
        async (
          tx
        ) => {
          /*
           * Atomically claim the reset token.
           *
           * A second request using the same link
           * must not also succeed.
           */
  
          const claimed =
            await tx.passwordResetToken.updateMany({
              where: {
                id:
                  resetToken.id,
  
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
            throw new PasswordResetError(
              "INVALID_OR_EXPIRED_PASSWORD_RESET"
            );
          }
  
          /*
           * Also ensure the account didn't become
           * disabled or have its password changed
           * between our read and this transaction.
           */
  
          const updatedUser =
            await tx.user.updateMany({
              where: {
                id:
                  resetToken.user.id,
  
                status:
                  "ACTIVE",
  
                passwordHash:
                  resetToken.user
                    .passwordHash,
              },
  
              data: {
                passwordHash:
                  newPasswordHash,
              },
            });
  
          if (
            updatedUser.count !==
            1
          ) {
            throw new PasswordResetError(
              "INVALID_OR_EXPIRED_PASSWORD_RESET"
            );
          }
  
          /*
           * Revoke EVERY existing login session.
           *
           * The user must authenticate again with
           * the new password.
           */
  
          await tx.authSession.updateMany({
            where: {
              userId:
                resetToken.user.id,
  
              revokedAt:
                null,
            },
  
            data: {
              revokedAt:
                now,
            },
          });
        }
      );
  
      return {
        success:
          true,
      };
    },
  };