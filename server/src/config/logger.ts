import { format } from "path";
import winston from "winston";

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

const isDev = process.env.NODE_ENV !== "production";

// custom log TIME format

const localTimeFormat = timestamp({
  format: () => new Date().toLocaleString(),
})

// readable format for dev
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}]: ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta) : ""
  }`;
});

export const logger = winston.createLogger({
  level: "info",
  format: combine(
    errors({ stack: true }),
    localTimeFormat,
    isDev ? combine(colorize(), devFormat) : json(),
  ),
  transports: [
    new winston.transports.Console(),

    // optional: file logging
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
    }),
  ],
});
