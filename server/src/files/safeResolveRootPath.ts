import path from "path";

export function safeResolveRootPath({ rootDir, relativePath }) {
  const rel = typeof relativePath === "string" ? relativePath : "";
  const cleaned = rel.replace(/\0/g, "").replace(/^\/+/, "");
  const absPath = path.resolve(rootDir, cleaned);

  const rootDirWithSep = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
  if (absPath !== rootDir && !absPath.startsWith(rootDirWithSep)) {
    const err = new Error("Invalid path");
    err.code = "INVALID_PATH";
    throw err;
  }

  return absPath;
}

