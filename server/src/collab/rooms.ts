import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { safeResolveRootPath } from "../files/safeResolveRootPath.ts";

const rooms = new Map();
const rootKeyCache = new Map(); // rootDir -> short hash

function ensureLeadingSlash(room) {
  if (typeof room !== "string") return "/";
  return room.startsWith("/") ? room : `/${room}`;
}

function roomMapKey({ rootDir, room }) {
  return `${rootDir}::${room}`;
}

function rootKeyForDir(rootDir) {
  const cached = rootKeyCache.get(rootDir);
  if (cached) return cached;
  const key = crypto.createHash("sha1").update(rootDir).digest("hex").slice(0, 12);
  rootKeyCache.set(rootDir, key);
  return key;
}

async function readInitialFileContent({ rootDir, room }) {
  const absPath = safeResolveRootPath({ rootDir, relativePath: room });
  try {
    const content = await fs.readFile(absPath, "utf8");
    return { absPath, content };
  } catch (err) {
    if (err?.code === "ENOENT") return { absPath, content: "" };
    throw err;
  }
}

function scheduleAutosave(roomState) {
  if (roomState.autosaveTimer) return;
  roomState.autosaveTimer = setTimeout(async () => {
    roomState.autosaveTimer = null;
    try {
      const content = roomState.ytext.toString();
      await fs.mkdir(path.dirname(roomState.absPath), { recursive: true });
      await fs.writeFile(roomState.absPath, content, "utf8");
    } catch (err) {
      console.error("Autosave failed:", err);
    }
  }, 400);
}

export async function getOrCreateRoom({ rootDir, room }) {
  const normalizedRoom = ensureLeadingSlash(room);
  const key = roomMapKey({ rootDir, room: normalizedRoom });
  const existing = rooms.get(key);
  if (existing) return existing;

  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const ytext = doc.getText("content");

  const { absPath, content } = await readInitialFileContent({
    rootDir,
    room: normalizedRoom,
  });

  if (content) {
    doc.transact(() => {
      ytext.insert(0, content);
    }, "server:init");
  }

  const roomState = {
    key,
    room: normalizedRoom,
    socketRoom: `ws:${rootKeyForDir(rootDir)}${normalizedRoom}`,
    rootDir,
    absPath,
    doc,
    awareness,
    ytext,
    refCount: 0,
    autosaveTimer: null,
    destroyTimer: null,
    bound: false,
  };

  doc.on("update", () => {
    scheduleAutosave(roomState);
  });

  rooms.set(key, roomState);
  return roomState;
}

export function getRoom({ rootDir, room }) {
  const normalizedRoom = ensureLeadingSlash(room);
  return rooms.get(roomMapKey({ rootDir, room: normalizedRoom })) ?? null;
}

export function retainRoom({ rootDir, room }) {
  const normalizedRoom = ensureLeadingSlash(room);
  const roomState = rooms.get(roomMapKey({ rootDir, room: normalizedRoom }));
  if (!roomState) return;
  roomState.refCount += 1;
  if (roomState.destroyTimer) {
    clearTimeout(roomState.destroyTimer);
    roomState.destroyTimer = null;
  }
}

export function releaseRoom({ rootDir, room }) {
  const normalizedRoom = ensureLeadingSlash(room);
  const key = roomMapKey({ rootDir, room: normalizedRoom });
  const roomState = rooms.get(key);
  if (!roomState) return;
  roomState.refCount -= 1;
  if (roomState.refCount > 0) return;

  roomState.destroyTimer = setTimeout(() => {
    rooms.delete(key);
    try {
      roomState.doc.destroy();
    } catch (err) {
      // ignore
    }
  }, 60_000);
}
