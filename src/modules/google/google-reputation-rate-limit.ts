import {
    ipKeyGenerator,
    rateLimit,
} from "express-rate-limit";

export const googleReputationRateLimit =
    rateLimit({
        /*
         * One-hour window.
         */
        windowMs:
            60 *
            60 *
            1000,

        /*
         * Maximum requests for the
         * same user + same store
         * during one hour.
         *
         * The UI already has a
         * 10-minute manual refresh
         * cooldown.
         *
         * 12 gives enough room for:
         * - initial dashboard load
         * - manual refreshes
         * - accidental page reloads
         *
         * while still protecting
         * Google API spending.
         */
        limit:
            12,

        standardHeaders:
            "draft-7",

        legacyHeaders:
            false,

        keyGenerator: (
            req
        ) => {
            const storeId =
                req.params.storeId ??
                "unknown-store";

            /*
             * This route runs:
             *
             * authenticate
             * ↓
             * rate limiter
             *
             * So normally req.user
             * always exists here.
             *
             * This gives every user/store
             * combination its own limit:
             *
             * USER_A + STORE_A
             * USER_A + STORE_B
             * USER_B + STORE_A
             */
            if (
                req.user?.id
            ) {
                return [
                    "user",
                    req.user.id,
                    "store",
                    storeId,
                ].join(":");
            }

            /*
             * Defensive fallback.
             *
             * NEVER use req.ip directly
             * in a custom keyGenerator.
             *
             * ipKeyGenerator correctly
             * normalizes IPv4/IPv6.
             */
            return [
                "ip",
                ipKeyGenerator(
                    req.ip as string
                ),
                "store",
                storeId,
            ].join(":");
        },

        handler: (
            _req,
            res
        ) => {
            return res
                .status(429)
                .json({
                    success:
                        false,

                    code:
                        "GOOGLE_REPUTATION_RATE_LIMITED",

                    message:
                        "Google reputation was refreshed too frequently. Please try again later.",
                });
        },
    });