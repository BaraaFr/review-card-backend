import { createHash } from "node:crypto";

import { env } from "../config/env.js";

export const createVisitorHash = (
  ip: string,
  userAgent: string
): string => {
  return createHash("sha256")
    .update(
      `${ip}|${userAgent}|${env.ANALYTICS_SALT}`
    )
    .digest("hex");
};