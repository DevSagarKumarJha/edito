import fs from "fs/promises";
import path from "path";
import { safeResolveRootPath } from "./safeResolveRootPath.js";

export async function writeTextFile({ rootDir, relativePath, content }) {
  const absPath = safeResolveRootPath({ rootDir, relativePath });
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, "utf8");
  return { absPath };
}
