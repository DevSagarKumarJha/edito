import express from "express";
import path from "path";
import {
  attachWorkspace,
  createWorkspace,
  findWorkspaceById,
  getActiveWorkspaceId,
  listWorkspaces,
  parseAllowedWorkspaceRoots,
  setActiveWorkspaceId,
} from "./store.ts";

function getBaseDir({ serverRoot }) {
  const raw = process.env.WORKSPACES_DIR;
  return path.resolve(raw && String(raw).trim() ? raw.trim() : path.join(serverRoot, "workspaces"));
}

export function createWorkspacesRouter({ userDir, requireAuth, serverRoot }) {
  const router = express.Router();
  const baseDir = getBaseDir({ serverRoot });
  const { allowAny, roots: allowedRoots } = parseAllowedWorkspaceRoots({ baseDir });

  router.get("/workspaces", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const [workspaces, activeId] = await Promise.all([
        listWorkspaces({ userDir, userId }),
        getActiveWorkspaceId({ userDir, userId }),
      ]);
      res.json({ workspaces, activeId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to list workspaces" });
    }
  });

  router.post("/workspaces/create", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const name = String(req.body?.name ?? "Workspace");
      const workspace = await createWorkspace({ userDir, userId, name, baseDir });
      res.json({ workspace });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create workspace" });
    }
  });

  router.post("/workspaces/attach", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const rootPath = String(req.body?.path ?? "");
      const name = String(req.body?.name ?? "");
      if (!rootPath) {
        res.status(400).json({ error: "Missing path" });
        return;
      }
      const workspace = await attachWorkspace({
        userDir,
        userId,
        name,
        rootPath,
        allowedRoots,
        allowAny,
      });
      res.json({ workspace });
    } catch (err) {
      if (err?.code === "WORKSPACE_NOT_ALLOWED") {
        res.status(403).json({
          error: "Workspace path not allowed",
          hint:
            "Set WORKSPACE_ALLOWED_ROOTS (colon-separated) or ALLOW_ANY_WORKSPACE=1 for local dev.",
        });
        return;
      }
      if (err?.code === "NOT_A_DIRECTORY") {
        res.status(400).json({ error: "Path must be a directory" });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Failed to attach workspace" });
    }
  });

  router.post("/workspaces/select", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const id = String(req.body?.id ?? "");
      if (!id) {
        res.status(400).json({ error: "Missing id" });
        return;
      }
      const workspace = await findWorkspaceById({ userDir, userId, id });
      if (!workspace) {
        res.status(404).json({ error: "Workspace not found" });
        return;
      }
      await setActiveWorkspaceId({ userDir, userId, workspaceId: id });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to select workspace" });
    }
  });

  router.get("/workspaces/allowed-roots", requireAuth, (_req, res) => {
    res.json({ allowAny, allowedRoots, baseDir });
  });

  return router;
}
