import {
    ipKeyGenerator,
    rateLimit,
  } from "express-rate-limit";
  
  export const publicAccountRequestRateLimit =
    rateLimit({
      windowMs:
        60 *
        60 *
        1000,
  
      /*
       * Five form submissions
       * per IP/hour is plenty.
       */
      limit:
        5,
  
      standardHeaders:
        "draft-7",
  
      legacyHeaders:
        false,
  
      keyGenerator: (
        req
      ) =>
        `account-request:${ipKeyGenerator(
          req.ip as string
        )}`,
  
      handler: (
        _req,
        res
      ) => {
        return res
          .status(429)
          .json({
            success: false,
  
            code:
              "ACCOUNT_REQUEST_RATE_LIMITED",
  
            message:
              "Too many requests were submitted. Please try again later.",
          });
      },
    });