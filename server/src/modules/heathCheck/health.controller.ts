import { Request, Response } from "express";
import { healthCheckService, HealthCheckServiceProps } from "./health.service";

export function healthCheckController(_req: Request, res: Response) {
  const result = healthCheckService({message: "OK", statusCode: 200} as HealthCheckServiceProps);

  res.status(result.statusCode).json(result);
}