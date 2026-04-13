import { createPtyProcess } from "../terminal/createPtyProcess.ts";
import { findWorkspaceById, getActiveWorkspaceId } from "../workspaces/store.ts";

export function registerTerminalSocket({ io, shell, userDir, env, watcher }) {
  const activePtys = new Set();

  io.on("connection", async (socket) => {
    console.log(`Connected: ${socket.id}`);

    socket.data.workspaceId = socket.data.workspaceId || "";

    const resolveWorkspaceRoot = async (workspaceId) => {
      if (!socket.data.user) return null;
      const userId = socket.data.user.id;
      const id = typeof workspaceId === "string" ? workspaceId : "";
      if (id) {
        const ws = await findWorkspaceById({ userDir, userId, id });
        return ws ? { id: ws.id, name: ws.name, rootPath: ws.rootPath } : null;
      }
      const activeId = await getActiveWorkspaceId({ userDir, userId });
      if (!activeId) return null;
      const ws = await findWorkspaceById({ userDir, userId, id: activeId });
      return ws ? { id: ws.id, name: ws.name, rootPath: ws.rootPath } : null;
    };

    let initialWorkspace = null;
    try {
      initialWorkspace = await resolveWorkspaceRoot(socket.data.workspaceId);
    } catch (err) {
      console.error("Failed to resolve initial workspace", err);
    }

    const initialRoot = initialWorkspace?.rootPath || socket.data.workspaceRoot || userDir;
    socket.data.workspaceRoot = initialRoot;
    if (initialWorkspace?.id) {
      socket.data.workspaceId = initialWorkspace.id;
    }
    if (watcher && typeof watcher.add === "function") {
      watcher.add(initialRoot);
    }

    let ptyProcess = createPtyProcess({ shell, userDir: initialRoot, env });
    activePtys.add(ptyProcess);

    const handleData = (data) => {
      socket.emit("terminal:data", data);
    };

    let dataSubscription = ptyProcess.onData(handleData);

    const restartPty = (nextRoot) => {
      try {
        if (dataSubscription && typeof dataSubscription.dispose === "function") {
          dataSubscription.dispose();
        }
      } catch {
        // ignore
      }
      try {
        ptyProcess.kill();
      } catch {
        // ignore
      }
      activePtys.delete(ptyProcess);

      ptyProcess = createPtyProcess({ shell, userDir: nextRoot, env });
      activePtys.add(ptyProcess);
      dataSubscription = ptyProcess.onData(handleData);
    };

    if (initialWorkspace?.name) {
      socket.emit("terminal:data", `\r\n[workspace] ${initialWorkspace.name}\r\n`);
    }

    socket.on("workspace:select", async ({ id } = {}, ack) => {
      try {
        const ws = await resolveWorkspaceRoot(id);
        if (!ws) {
          if (typeof ack === "function") ack({ error: socket.data.user ? "not_found" : "unauthorized" });
          return;
        }
        socket.data.workspaceRoot = ws.rootPath;
        socket.data.workspaceId = ws.id;
        if (watcher && typeof watcher.add === "function") {
          watcher.add(ws.rootPath);
        }
        restartPty(ws.rootPath);
        socket.emit("terminal:data", `\r\n[workspace] ${ws.name}\r\n`);
        if (typeof ack === "function") ack({ ok: true, workspace: { id: ws.id, name: ws.name } });
      } catch (err) {
        console.error("workspace:select error", err);
        if (typeof ack === "function") ack({ error: "select_failed" });
      }
    });

    socket.on("terminal:write", (data) => {
      if (typeof data === "string") {
        ptyProcess.write(data);
      }
    });

    socket.on("terminal:run", ({ cmd } = {}) => {
      if (typeof cmd !== "string") return;
      const cleaned = cmd.replace(/\0/g, "").slice(0, 4000);
      if (!cleaned.trim()) return;
      ptyProcess.write(cleaned.endsWith("\n") ? cleaned : cleaned + "\r");
    });

    socket.on("terminal:resize", ({ cols, rows }) => {
      try {
        ptyProcess.resize(cols, rows);
      } catch (err) {
        console.error("Resize error:", err);
      }
    });

    socket.on("disconnect", () => {
      // node-pty's `onData` returns an IDisposable; dispose it to remove the listener.
      if (dataSubscription && typeof dataSubscription.dispose === "function") {
        dataSubscription.dispose();
      }
      try {
        ptyProcess.kill();
      } catch (err) {
        console.error("Error killing PTY:", err);
      }
      activePtys.delete(ptyProcess);
      console.log(`Disconnected: ${socket.id}`);
    });
  });

  return {
    killAll() {
      for (const ptyProcess of activePtys) {
        try {
          ptyProcess.kill();
        } catch (err) {
          console.error("Error killing PTY:", err);
        }
      }
      activePtys.clear();
    },
  };
}
