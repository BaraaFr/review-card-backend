import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import redirectRoutes from "./modules/redirect/redirect.routes.js";
import { queueDashboardAdapter } from "./modules/queues/queue-dashboard.js";
import { authenticate } from "./middleware/auth.middleware.js";
import { authorize } from "./middleware/role.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { startBackgroundJobs } from "./modules/queues/background-jobs.js";

const app = express();

startBackgroundJobs();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(helmet());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());

app.use(
  "/api/admin/queues",
  authenticate,
  authorize(
    "SUPER_ADMIN"
  ),
  queueDashboardAdapter.getRouter()
);

app.get(
  "/api/health",
  (_req, res) => {
    return res.status(200).json({
      success: true,
      message: "Review Card API is running",
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

app.use(errorHandler);

export default app;
