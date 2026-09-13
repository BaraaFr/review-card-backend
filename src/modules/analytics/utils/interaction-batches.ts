import { prisma } from "../../../lib/prisma.js";

type InteractionRow = { id: string; createdAt: Date; visitorKey: string | null };
const BATCH_SIZE = 1000;

export async function* iterateMeaningfulInteractions(
  storeId: string, from: Date, to: Date,
): AsyncGenerator<InteractionRow> {
  let after: InteractionRow | undefined;
  while (true) {
    const rows: InteractionRow[] = await prisma.interaction.findMany({
      where: {
        storeId, isDuplicate: false, isBot: false,
        createdAt: { gte: from, lt: to },
        ...(after ? {
          OR: [
            { createdAt: { gt: after.createdAt } },
            { createdAt: after.createdAt, id: { gt: after.id } },
          ],
        } : {}),
      },
      select: { id: true, createdAt: true, visitorKey: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: BATCH_SIZE,
    });
    for (const row of rows) yield row;
    if (rows.length < BATCH_SIZE) return;
    after = rows[rows.length - 1];
  }
}
