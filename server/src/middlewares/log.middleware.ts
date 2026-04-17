// src/middlewares/logger.ts
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../utils/logger";
import {asyncHandler} from "../utils/asyncHandler";

// asynchandler
const loggingMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();

  const requestId =
    (req.headers["x-request-id"] as string) ||
    crypto.randomUUID();

  res.setHeader("x-request-id", requestId);

  const { method, originalUrl } = req;
  const ip = req.ip || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - start) / 1_000_000;

    const logMeta = {
      requestId,
      method,
      url: originalUrl,
      status: res.statusCode,
      duration: `${durationMs.toFixed(2)}ms`,
      ip,
      userAgent,
    };

    if (res.statusCode >= 500) {
      logger.error("HTTP Request", logMeta);
    } else if (res.statusCode >= 400) {
      logger.warn("HTTP Request", logMeta);
    } else {
      logger.info("HTTP Request", logMeta);
    }
  });

  next();
});

export default loggingMiddleware;