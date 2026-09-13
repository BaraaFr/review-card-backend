import bcrypt from "bcrypt";

import {
  prisma,
} from "../../lib/prisma.js";

import type {
  ChangePasswordInput,
  UpdateProfileInput,
} from "./account.schema.js";

/*
 * =========================================================
 * Public profile select
 * =========================================================
 */

const profileSelect = {
  id:
    true,

  name:
    true,

  email:
    true,

  phoneNumber:
    true,

  role:
    true,

  createdAt:
    true,

  updatedAt:
    true,
} as const;

/*
 * =========================================================
 * Get profile
 * =========================================================
 */

export async function getAccountProfile(
  userId: string
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id:
          userId,
      },

      select:
        profileSelect,
    });

  if (
    !user
  ) {
    throw new Error(
      "USER_NOT_FOUND"
    );
  }

  return user;
}

/*
 * =========================================================
 * Update profile
 * =========================================================
 */

export async function updateAccountProfile(
  userId: string,
  input: UpdateProfileInput
) {
  const existingUser =
    await prisma.user.findUnique({
      where: {
        id:
          userId,
      },

      select: {
        id:
          true,
      },
    });

  if (
    !existingUser
  ) {
    throw new Error(
      "USER_NOT_FOUND"
    );
  }

  return prisma.user.update({
    where: {
      id:
        userId,
    },

    data: {
      name:
        input.name,

      phoneNumber:
        input.phoneNumber ??
        null,
    },

    select:
      profileSelect,
  });
}

/*
 * =========================================================
 * Change password
 * =========================================================
 */

export async function changeAccountPassword(
  userId: string,
  input: ChangePasswordInput
) {
  /*
   * We need the password hash here,
   * but it is never returned to the frontend.
   */

  const user =
    await prisma.user.findUnique({
      where: {
        id:
          userId,
      },

      select: {
        id:
          true,

        passwordHash:
          true,
      },
    });

  if (
    !user
  ) {
    throw new Error(
      "USER_NOT_FOUND"
    );
  }

  /*
   * =======================================================
   * Verify current password
   * =======================================================
   */

  const currentPasswordIsValid =
    !!user.passwordHash && await bcrypt.compare(
      input.currentPassword,
      user.passwordHash!
    );

  if (
    !currentPasswordIsValid
  ) {
    throw new Error(
      "CURRENT_PASSWORD_INVALID"
    );
  }

  /*
   * =======================================================
   * Prevent reusing the current password
   * =======================================================
   *
   * This is better than only comparing the raw strings.
   *
   * bcrypt hashes differ even for the same password,
   * so we compare the new raw password with the
   * existing password hash.
   */

  const sameAsCurrent =
    await bcrypt.compare(
      input.newPassword,
      user.passwordHash!
    );

  if (
    sameAsCurrent
  ) {
    throw new Error(
      "PASSWORD_NOT_CHANGED"
    );
  }

  /*
   * =======================================================
   * Hash new password
   * =======================================================
   */

  const passwordHash =
    await bcrypt.hash(
      input.newPassword,
      12
    );

  /*
   * =======================================================
   * Update user
   * =======================================================
   */

  await prisma.$transaction(async (tx) => {
    // Do not overwrite a password changed after this request verified it.
    const updated = await tx.user.updateMany({
      where: { id: userId, passwordHash: user.passwordHash },
      data: { passwordHash },
    });
    if (updated.count !== 1) throw new Error("CURRENT_PASSWORD_INVALID");

    // A password change ends every existing session, including this one.
    await tx.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  return {
    success:
      true,
  };
}