import { getConfig } from "./src/config.js";
import { startServer } from "./src/server.js";

startServer(getConfig());
