import fs from "fs/promises";
import { safeResolveRootPath } from "./safeResolveRootPath.js";

export async function createFolder({ rootDir, relativePath }) {
  const absPath = safeResolveRootPath({ rootDir, relativePath });
  await fs.mkdir(absPath, { recursive: true });
  return { absPath };
}
