export type HealthCheckResult = {
  message: string;
  statusCode: number;
  timestamp: string;
  uptime: number;
};

export type HealthCheckServiceProps = {
  message?: string;
  statusCode?: number;
};

export function healthCheckService({message, statusCode}: HealthCheckServiceProps): HealthCheckResult {
  return {
    message: message || "OK",
    statusCode: statusCode || 200,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}