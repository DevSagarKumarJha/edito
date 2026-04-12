import express from "express";
import { generateFileTree } from "./generateFileTree.js";
import { readTextFile } from "./readTextFile.js";
import { writeTextFile } from "./writeTextFile.js";
import { createFolder } from "./createFolder.js";
import { findWorkspaceById, getActiveWorkspaceId } from "../workspaces/store.js";

async function resolveRootDir({ req, userDir }) {
  if (!req.user) return userDir;

  const userId = req.user.id;
  const headerId = req.headers["x-workspace-id"];
  const workspaceId = typeof headerId === "string" ? headerId : "";

  if (workspaceId) {
    const ws = await findWorkspaceById({ userDir, userId, id: workspaceId });
    return ws?.rootPath || userDir;
  }

  const activeId = await getActiveWorkspaceId({ userDir, userId });
  if (!activeId) return userDir;
  const ws = await findWorkspaceById({ userDir, userId, id: activeId });
  return ws?.rootPath || userDir;
}

export function createFilesRouter({ userDir, requireWriteAuth = null }) {
  const router = express.Router();

  router.get("/files", async (req, res) => {
    try {
      const rootDir = await resolveRootDir({ req, userDir });
      const fileTree = await generateFileTree(rootDir);
      res.json({ tree: fileTree });
    } catch (err) {
      res.status(500).json({ error: "Failed to read files" });
    }
  });

  router.get("/file", async (req, res) => {
    try {
      const relativePath = String(req.query.path ?? "");
      const rootDir = await resolveRootDir({ req, userDir });
      const { content } = await readTextFile({ rootDir, relativePath });
      res.json({ path: relativePath, content });
    } catch (err) {
      if (err?.code === "ENOENT") {
        res.status(404).json({ error: "File not found" });
        return;
      }
      if (err?.code === "INVALID_PATH") {
        res.status(400).json({ error: "Invalid path" });
        return;
      }
      res.status(500).json({ error: "Failed to read file" });
    }
  });

  const writeGuards = requireWriteAuth ? [requireWriteAuth] : [];

  router.put("/file", ...writeGuards, async (req, res) => {
    try {
      const relativePath = String(req.query.path ?? "");
      const content = typeof req.body?.content === "string" ? req.body.content : "";
      const rootDir = await resolveRootDir({ req, userDir });
      await writeTextFile({ rootDir, relativePath, content });
      res.json({ ok: true });
    } catch (err) {
      if (err?.code === "INVALID_PATH") {
        res.status(400).json({ error: "Invalid path" });
        return;
      }
      res.status(500).json({ error: "Failed to write file" });
    }
  });

  router.post("/folder", ...writeGuards, async (req, res) => {
    try {
      const relativePath = String(req.query.path ?? "");
      const rootDir = await resolveRootDir({ req, userDir });
      await createFolder({ rootDir, relativePath });
      res.json({ ok: true });
    } catch (err) {
      if (err?.code === "INVALID_PATH") {
        res.status(400).json({ error: "Invalid path" });
        return;
      }
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  return router;
}
