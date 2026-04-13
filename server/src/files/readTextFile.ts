import fs from "fs/promises";
import { safeResolveRootPath } from "./safeResolveRootPath.ts";

export async function readTextFile({ rootDir, relativePath }) {
  const absPath = safeResolveRootPath({ rootDir, relativePath });
  const content = await fs.readFile(absPath, "utf8");
  return { absPath, content };
}
