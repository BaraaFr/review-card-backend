import express
  from "express";

import cors
  from "cors";

import helmet
  from "helmet";

import cookieParser
  from "cookie-parser";

import {
  env,
} from "./config/env.js";

import routes
  from "./routes/index.js";

import redirectRoutes
  from "./modules/redirect/redirect.routes.js";

import {
  queueDashboardAdapter,
} from "./modules/queues/queue-dashboard.js";

import {
  authenticate,
} from "./middleware/auth.middleware.js";

import {
  authorize,
} from "./middleware/role.middleware.js";

import {
  errorHandler,
} from "./middleware/error.middleware.js";

import {
  trustedOrigin,
} from "./middleware/trusted-origin.js";

import {
  isReady,
} from "./lib/readiness.js";
import { requestObservability } from "./middleware/request-observability.js";

const app =
  express();

/*
 * Only configure this when we
 * actually know which reverse
 * proxies are trusted.
 */
if (
  process.env
    .TRUST_PROXY
    ?.trim()
) {
  app.set(
    "trust proxy",

    process.env
      .TRUST_PROXY
      .split(",")
      .map(
        (
          value
        ) =>
          value.trim()
      )
  );
}

/*
 * Do not advertise Express.
 */
app.disable(
  "x-powered-by"
);
/*
 * Every request gets a correlation ID,
 * including requests rejected by:
 *
 * - CORS
 * - trusted-origin
 * - body parser
 * - authentication
 * - rate limiting
 */
app.use(
  requestObservability
);

app.use(
  cors({
    origin:
      env.FRONTEND_URL,

    credentials:
      true,
  })
);

app.use(
  helmet()
);

/*
 * CSRF-style protection for
 * cookie-authenticated mutations.
 *
 * Keep this before body parsing so
 * an untrusted request is rejected
 * before we spend work parsing it.
 */
app.use(
  trustedOrigin
);

/*
 * Avoid unbounded request bodies.
 */
app.use(
  express.json({
    limit:
      "100kb",
  })
);

app.use(
  express.urlencoded({
    extended:
      false,

    limit:
      "100kb",
  })
);

app.use(
  cookieParser()
);

/*
 * API responses often include
 * sensitive/account-specific data.
 */
app.use(
  "/api",

  (
    _req,
    res,
    next
  ) => {
    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    next();
  }
);

/*
 * Readiness:
 *
 * Can this instance actually serve
 * traffic right now?
 */
app.get(
  "/api/ready",

  async (
    _req,
    res
  ) => {
    const ready =
      await isReady();

    return res
      .status(
        ready
          ? 200
          : 503
      )
      .json({
        success:
          ready,
      });
  }
);

/*
 * Queue dashboard remains
 * SuperAdmin-only.
 */
app.use(
  "/api/admin/queues",

  authenticate,

  authorize(
    "SUPER_ADMIN"
  ),

  queueDashboardAdapter
    .getRouter()
);

/*
 * Liveness:
 *
 * Is the Node process alive?
 *
 * Unlike readiness this does NOT
 * require DB/Redis.
 */
app.get(
  "/api/health",

  (
    _req,
    res
  ) => {
    return res
      .status(200)
      .json({
        success:
          true,

        message:
          "Review Card API is running",
      });
  }
);

app.use(
  "/r",
  redirectRoutes
);

app.use(
  "/api",
  routes
);

app.use(
  errorHandler
);

export default app;