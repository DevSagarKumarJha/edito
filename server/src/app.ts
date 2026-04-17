import express from "express";

import cors from "cors";
import healthCheckRouter from "./modules/heathCheck/health.routes";
import { loggingMiddleware } from "./middlewares";


export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(loggingMiddleware);

  app.use("/health", healthCheckRouter);

  return app;
}
