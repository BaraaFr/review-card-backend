import { randomBytes } from "node:crypto";

import { prisma } from "../lib/prisma.js";

export const generateUniqueCardCode =
  async (): Promise<string> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomBytes(6)
        .toString("hex")
        .toUpperCase();

      const existingCard =
        await prisma.card.findUnique({
          where: {
            code,
          },
          select: {
            id: true,
          },
        });

      if (!existingCard) {
        return code;
      }
    }

    throw new Error(
      "FAILED_TO_GENERATE_CARD_CODE"
    );
  };