import "dotenv/config";
import startServer from "./server";
import type { startServerConfigProps } from "types/src";

const config: startServerConfigProps = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  db_url: process.env.DB_URL || "mongodb://localhost:27017/edito",
};

startServer(config);
