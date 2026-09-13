import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { hashActivationToken } from "../../utils/activation-token.js";
import type { ActivateAccountInput, LoginInput } from "./auth.schema.js";

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_NOT_ACTIVE"
  | "INVALID_OR_EXPIRED_INVITATION"
  | "ACCOUNT_ALREADY_ACTIVE"
  | "INVITATION_ALREADY_USED";

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code);
  }
}

const publicUserSelect = {
  id: true, name: true, email: true, role: true, status: true,
} as const;

export const authService = {
  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
      select: { ...publicUserSelect, passwordHash: true },
    });
    if (!user || !user.passwordHash) throw new AuthError("INVALID_CREDENTIALS");
    if (user.status === "DISABLED") throw new AuthError("ACCOUNT_DISABLED");
    if (user.status !== "ACTIVE") throw new AuthError("ACCOUNT_NOT_ACTIVE");
    if (!await bcrypt.compare(data.password, user.passwordHash)) {
      throw new AuthError("INVALID_CREDENTIALS");
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
  },

  async activateAccount(data: ActivateAccountInput) {
    const tokenHash = hashActivationToken(data.token);
    const now = new Date();
    const invitation = await prisma.accountInvitation.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      include: { user: { select: publicUserSelect } },
    });
    if (!invitation) throw new AuthError("INVALID_OR_EXPIRED_INVITATION");
    if (invitation.user.status === "DISABLED") throw new AuthError("ACCOUNT_DISABLED");
    if (invitation.user.status === "ACTIVE") throw new AuthError("ACCOUNT_ALREADY_ACTIVE");

    const passwordHash = await bcrypt.hash(data.password, 12);
    return prisma.$transaction(async (tx) => {
      // Keep the active controller's atomic usedAt claim as the single rule.
      const claimed = await tx.accountInvitation.updateMany({
        where: { id: invitation.id, tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new AuthError("INVITATION_ALREADY_USED");
      return tx.user.update({
        where: { id: invitation.user.id },
        data: { passwordHash, status: "ACTIVE" },
        select: publicUserSelect,
      });
    });
  },
};
