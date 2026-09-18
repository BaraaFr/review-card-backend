import "dotenv/config";

import {
  PrismaClient,
} from "../../generated/prisma/client.js";

if (
  !process.env
    .DATABASE_URL
) {
  throw new Error(
    "DATABASE_URL is not defined"
  );
}

export const prisma =
  new PrismaClient();