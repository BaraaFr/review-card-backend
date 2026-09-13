import type {
  UserRole,
  UserStatus,
} from "../../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;

        name: string;

        email: string;

        role: UserRole;

        status: UserStatus;
      };
    }
  }
}

export {};