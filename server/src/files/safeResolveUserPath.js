import path from "path";
import { safeResolveRootPath } from "./safeResolveRootPath.js";

export function safeResolveUserPath({ userDir, relativePath }) {
  // Back-compat wrapper.
  return safeResolveRootPath({ rootDir: userDir, relativePath });
}
