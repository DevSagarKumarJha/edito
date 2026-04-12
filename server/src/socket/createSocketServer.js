import { Server as SocketServer } from "socket.io";
import chokidar from "chokidar";
import { verifyToken } from "../auth/tokens.js";
import { findUserById } from "../auth/store.js";

export function createSocketServer({ httpServer, corsOrigin, userDir, jwtSecret }) {
  const watcher = chokidar.watch(userDir, { ignoreInitial: true });
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
