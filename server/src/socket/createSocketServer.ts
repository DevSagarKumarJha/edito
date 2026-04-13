import { Server as SocketServer } from "socket.io";
import chokidar from "chokidar";
import path from "path";
import { verifyToken } from "../auth/tokens.ts";
import { findUserById } from "../auth/store.ts";
import { parseAllowedWorkspaceRoots } from "../workspaces/store.ts";

function getBaseDir(serverRoot) {
  const raw = process.env.WORKSPACES_DIR;
  return path.resolve(
    raw && String(raw).trim() ? raw.trim() : path.join(serverRoot, "workspaces"),
  );
}

export function createSocketServer({ httpServer, corsOrigin, userDir, jwtSecret, serverRoot }) {
  const baseDir = getBaseDir(serverRoot);
  const { roots } = parseAllowedWorkspaceRoots({ baseDir });
  const watchPaths = Array.from(new Set([userDir, ...roots]));
  const watcher = chokidar.watch(watchPaths, { ignoreInitial: true });
  const io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigin,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake?.auth?.token;
    if (!token || typeof token !== "string") {
      socket.data.user = null;
      next();
      return;
    }
    try {
      const payload = verifyToken({ jwtSecret, token });
      const user = await findUserById({ userDir, id: payload.sub });
      socket.data.user = user ? { id: user.id, email: user.email, name: user.name } : null;
    } catch {
      socket.data.user = null;
    }
    next();
  });

  watcher.on("all", (_event, filePath) => {
    io.emit("file:refresh", filePath);
  });

  httpServer.on("close", () => {
    watcher.close();
  });

  return { io, watcher };
}
