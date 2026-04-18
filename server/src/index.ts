import "dotenv/config";
import startServer from "./server";
import type { startServerConfigProps } from "./types";
const port = Number(process.env.PORT);

if (!process.env.DB_URL) {
  throw new Error("DB_URL is required");
}

const config: startServerConfigProps = {
  port: Number.isFinite(port) ? port : 3000,
  db_url: process.env.DB_URL,
};

startServer(config);
