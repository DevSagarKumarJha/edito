import { getConfig } from "./src/config.ts";
import { startServer } from "./src/server.ts";

startServer(getConfig());
