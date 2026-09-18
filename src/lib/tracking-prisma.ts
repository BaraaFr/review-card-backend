import {
    PrismaClient,
  } from "../../generated/prisma/client.js";
  
  if (
    !process.env.DATABASE_URL
  ) {
    throw new Error(
      "DATABASE_URL is required"
    );
  }
  
  /*
   * =========================================================
   * Dedicated public-tracking connection pool
   * =========================================================
   *
   * NFC/QR redirects are public traffic.
   *
   * We do NOT want:
   *
   * bot traffic
   * scan bursts
   * slow analytics inserts
   *
   * consuming every connection used by:
   *
   * login
   * admin pages
   * payments
   * subscriptions
   * dashboards
   *
   * So interaction writes receive their
   * own intentionally tiny DB pool.
   */
  const url =
    new URL(
      process.env.DATABASE_URL
    );
  
  url.searchParams.set(
    "connection_limit",
    "2"
  );
  
  url.searchParams.set(
    "pool_timeout",
    "1"
  );
  
  url.searchParams.set(
    "connect_timeout",
    "2"
  );
  
  export const trackingPrisma =
    new PrismaClient({
      datasources: {
        db: {
          url:
            url.toString(),
        },
      },
    });