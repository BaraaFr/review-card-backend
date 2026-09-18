import {
  sharedRateLimit,
} from "../../middleware/shared-rate-limit.js";

export const publicAccountRequestRateLimit =
  sharedRateLimit(
    "account-request",

    5,

    60 *
      60 *
      1000
  );