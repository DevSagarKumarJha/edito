import { Request, Response, Router } from "express";
import { finished } from "stream";

export const healthCheckRouter = Router();

// Health check endpoint
healthCheckRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "ok",
    statusCode: res.statusCode,
    timestamp: new Date().toLocaleString(),
  });
});
