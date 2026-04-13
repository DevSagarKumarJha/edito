import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getMongoDb } from "../db/mongo.ts";

function workspacesDirPath({ userDir }) {
  return path.join(userDir, ".workspaces");
}

function workspacesFilePath({ userDir }) {
  return path.join(workspacesDirPath({ userDir }), "workspaces.json");
}

function stateFilePath({ userDir }) {
  return path.join(workspacesDirPath({ userDir }), "state.json");
}

function normalizeName(name) {
  const s = String(name || "").trim();
  return s.length ? s.slice(0, 60) : "Workspace";
}

function slugify(name) {
  const s = normalizeName(name).toLowerCase();
  const slug = s
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 40);
  return slug || "workspace";
}

function ensureTrailingSep(p) {
  return p.endsWith(path.sep) ? p : p + path.sep;
}

export function parseAllowedWorkspaceRoots({ baseDir }) {
  const raw = process.env.WORKSPACE_ALLOWED_ROOTS;
  const allowAny = String(process.env.ALLOW_ANY_WORKSPACE || "") === "1";
  const roots = (raw ? raw.split(path.delimiter) : [baseDir])
    .map((r) => String(r || "").trim())
    .filter(Boolean)
    .map((r) => path.resolve(r));
  return { allowAny, roots };
}

export function assertWorkspacePathAllowed({ absPath, allowedRoots, allowAny }) {
  const p = path.resolve(absPath);
  if (allowAny) return p;
  for (const root of allowedRoots) {
    const rootWithSep = ensureTrailingSep(root);
    if (p === root || p.startsWith(rootWithSep)) return p;
  }
  const err = new Error("Workspace path is not allowed");
  err.code = "WORKSPACE_NOT_ALLOWED";
  throw err;
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function listWorkspacesFile({ userDir, userId }) {
  const list = await readJsonFile(workspacesFilePath({ userDir }), []);
  if (!Array.isArray(list)) return [];
  return list.filter((w) => w && w.userId === userId);
}

async function putWorkspaceFile({ userDir, workspace }) {
  const filePath = workspacesFilePath({ userDir });
  const list = await readJsonFile(filePath, []);
  const next = Array.isArray(list) ? list.slice() : [];
  const idx = next.findIndex((w) => w && w.id === workspace.id);
  if (idx === -1) next.push(workspace);
  else next[idx] = workspace;
  await writeJsonFile(filePath, next);
}

async function readStateFile({ userDir }) {
  const state = await readJsonFile(stateFilePath({ userDir }), { activeByUser: {} });
  if (!state || typeof state !== "object") return { activeByUser: {} };
  if (!state.activeByUser || typeof state.activeByUser !== "object") {
    return { activeByUser: {} };
  }
  return state;
}

async function setActiveWorkspaceFile({ userDir, userId, workspaceId }) {
  const state = await readStateFile({ userDir });
  state.activeByUser[userId] = workspaceId;
  await writeJsonFile(stateFilePath({ userDir }), state);
}

async function getActiveWorkspaceIdFile({ userDir, userId }) {
  const state = await readStateFile({ userDir });
  const id = state.activeByUser?.[userId];
  return typeof id === "string" ? id : "";
}

export async function listWorkspaces({ userDir, userId }) {
  const db = await getMongoDb();
  if (db) {
    return db
      .collection("workspaces")
      .find({ userId })
      .project({ _id: 0 })
      .sort({ createdAt: 1 })
      .toArray();
  }
  return listWorkspacesFile({ userDir, userId });
}

export async function findWorkspaceById({ userDir, userId, id }) {
  const db = await getMongoDb();
  if (db) {
    return (
      (await db.collection("workspaces").findOne({ id, userId }, { projection: { _id: 0 } })) ??
      null
    );
  }
  const list = await listWorkspacesFile({ userDir, userId });
  return list.find((w) => w.id === id) ?? null;
}

export async function getActiveWorkspaceId({ userDir, userId }) {
  const db = await getMongoDb();
  if (db) {
    const user = await db
      .collection("users")
      .findOne({ id: userId }, { projection: { _id: 0, activeWorkspaceId: 1 } });
    return typeof user?.activeWorkspaceId === "string" ? user.activeWorkspaceId : "";
  }
  return getActiveWorkspaceIdFile({ userDir, userId });
}

export async function setActiveWorkspaceId({ userDir, userId, workspaceId }) {
  const db = await getMongoDb();
  if (db) {
    await db.collection("users").updateOne({ id: userId }, { $set: { activeWorkspaceId: workspaceId } });
    return;
  }
  await setActiveWorkspaceFile({ userDir, userId, workspaceId });
}

export async function createWorkspace({
  userDir,
  userId,
  name,
  baseDir,
}) {
  const id = randomUUID();
  const safeName = normalizeName(name);
  const slug = slugify(safeName);
  const rootPath = path.resolve(baseDir, userId, `${slug}-${id.slice(0, 6)}`);
  await fs.mkdir(rootPath, { recursive: true });

  const workspace = {
    id,
    userId,
    name: safeName,
    rootPath,
    createdAt: new Date().toISOString(),
  };

  const db = await getMongoDb();
  if (db) {
    await db.collection("workspaces").insertOne(workspace);
  } else {
    await putWorkspaceFile({ userDir, workspace });
  }

  await setActiveWorkspaceId({ userDir, userId, workspaceId: id });
  return workspace;
}

export async function attachWorkspace({
  userDir,
  userId,
  name,
  rootPath,
  allowedRoots,
  allowAny,
}) {
  const absPath = assertWorkspacePathAllowed({ absPath: rootPath, allowedRoots, allowAny });
  const stat = await fs.stat(absPath);
  if (!stat.isDirectory()) {
    const err = new Error("Workspace path must be a directory");
    err.code = "NOT_A_DIRECTORY";
    throw err;
  }

  const id = randomUUID();
  const workspace = {
    id,
    userId,
    name: normalizeName(name || path.basename(absPath)),
    rootPath: absPath,
    createdAt: new Date().toISOString(),
  };

  const db = await getMongoDb();
  if (db) {
    await db.collection("workspaces").insertOne(workspace);
  } else {
    await putWorkspaceFile({ userDir, workspace });
  }

  await setActiveWorkspaceId({ userDir, userId, workspaceId: id });
  return workspace;
}
