import http from "http";
import { createApp } from "./app";
import { connectDB } from "./db/connect";
import { startServerConfigProps } from "./types";

async function startServer({ port, db_url }: startServerConfigProps) {
  try {
    await connectDB(db_url);
  } catch (error) {
    console.error("Error connecting to database:", error);
    throw error;
  }
  const app = createApp();
  const server = http.createServer(app);

  server.on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`[[32mdev[39m] view the server at http://localhost:${port}`);
  });

  process.on("SIGINT", () => {
    console.log("Shutting down server...");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

export default startServer;
