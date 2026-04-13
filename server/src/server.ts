import http from "http";
import { createApp } from "./app.ts";
import { createSocketServer } from "./socket/createSocketServer.ts";
import { registerTerminalSocket } from "./socket/registerTerminalSocket.ts";
import { registerCollabSocket } from "./socket/registerCollabSocket.ts";

export function startServer({
  port,
  corsOrigin,
  userDir,
  shell,
  jwtSecret,
  clientUrl,
  githubClientId,
  githubClientSecret,
  serverRoot,
}) {
  const app = createApp({
    corsOrigin,
    userDir,
    jwtSecret,
    clientUrl,
    githubClientId,
    githubClientSecret,
    serverRoot,
  });
  const httpServer = http.createServer(app);

  // Register socket layer (modular)
  const { io, watcher } = createSocketServer({ httpServer, corsOrigin, userDir, jwtSecret, serverRoot });
  const terminalSockets = registerTerminalSocket({ io, shell, userDir, env: process.env, watcher });
  registerCollabSocket({ io, userDir });

  // HTTP server error handling
  httpServer.on("error", (err) => {
    console.error("HTTP server error:", err);
    process.exitCode = 1;
  });

  // Start server
  httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

  // -------------------------------
  // 🔴 Process-level error handling
  // -------------------------------
  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
  });

  process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err);
  });

  // -------------------------------
  // 🔴 Graceful shutdown
  // -------------------------------
  const shutdown = (signal) => {
    console.log(`\nReceived ${signal}. Shutting down...`);

    try {
      // Stop accepting new connections
      httpServer.close(() => {
        console.log("HTTP server closed");
      });

      // Close socket.io
      if (io) {
        io.close();
        console.log("Socket.IO closed");
      }

      // PTYs are created per-socket; ensure they are not orphaned on shutdown.
      terminalSockets?.killAll?.();
    } catch (err) {
      console.error("Shutdown error:", err);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return { app, httpServer, io };
}
