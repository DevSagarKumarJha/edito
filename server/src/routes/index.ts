import { Request, Response, Router } from "express";

export const healthCheckRouter = Router();

// Health check endpoint
healthCheckRouter.get("/", (_req: Request, res: Response) => {
  res.json({ message: "ok", status: 200 });
});
