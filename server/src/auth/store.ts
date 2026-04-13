import fs from "fs/promises";
import path from "path";
import { getMongoDb } from "../db/mongo.ts";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function usersFilePath({ userDir }) {
  return path.join(userDir, ".auth", "users.json");
}

async function readUsersFile({ userDir }) {
  const filePath = usersFilePath({ userDir });
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

async function writeUsersFile({ userDir, users }) {
  const filePath = usersFilePath({ userDir });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(users, null, 2), "utf8");
}

export async function findUserByEmail({ userDir, email }) {
  const db = await getMongoDb();
  if (db) {
    const needle = normalizeEmail(email);
    if (!needle) return null;
    return (
      (await db.collection("users").findOne({
        $or: [
          { emailLower: needle },
          { email: { $regex: `^${escapeRegExp(needle)}$`, $options: "i" } },
        ],
      })) ?? null
    );
  }
  const users = await readUsersFile({ userDir });
  const needle = normalizeEmail(email);
  return users.find((u) => normalizeEmail(u.email) === needle) ?? null;
}

export async function findUserByGithubId({ userDir, githubId }) {
  const db = await getMongoDb();
  if (db) {
    const needle = String(githubId || "");
    if (!needle) return null;
    return (await db.collection("users").findOne({ githubId: needle })) ?? null;
  }
  const users = await readUsersFile({ userDir });
  return users.find((u) => u.githubId === githubId) ?? null;
}

export async function findUserById({ userDir, id }) {
  const db = await getMongoDb();
  if (db) {
    const needle = String(id || "");
    if (!needle) return null;
    return (await db.collection("users").findOne({ id: needle })) ?? null;
  }
  const users = await readUsersFile({ userDir });
  return users.find((u) => u.id === id) ?? null;
}

export async function createUser({ userDir, user }) {
  const db = await getMongoDb();
  if (db) {
    const doc = {
      ...user,
      emailLower: user?.email ? normalizeEmail(user.email) : "",
    };
    await db.collection("users").insertOne(doc);
    return user;
  }
  const users = await readUsersFile({ userDir });
  users.push(user);
  await writeUsersFile({ userDir, users });
  return user;
}

export async function updateUser({ userDir, id, patch }) {
  const db = await getMongoDb();
  if (db) {
    const needle = String(id || "");
    if (!needle) return null;
    const $set = {
      ...patch,
    };
    if (Object.prototype.hasOwnProperty.call(patch ?? {}, "email")) {
      $set.emailLower = patch?.email ? normalizeEmail(patch.email) : "";
    }
    const result = await db.collection("users").findOneAndUpdate(
      { id: needle },
      { $set },
      { returnDocument: "after" },
    );
    return result?.value ?? null;
  }
  const users = await readUsersFile({ userDir });
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  await writeUsersFile({ userDir, users });
  return users[idx];
}
