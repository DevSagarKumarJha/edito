import path from "path";
import { fileURLToPath } from "url";

function getServerRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

export function getConfig() {
  const serverRoot = getServerRoot();
  const userDir = process.env.USER_DIR
    ? path.resolve(serverRoot, process.env.USER_DIR)
    : path.join(serverRoot, "user");

  return {
    serverRoot,
    port: Number(process.env.PORT ?? 9000),
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
    userDir,
    shell: process.platform === "win32" ? "powershell.exe" : "bash",
    jwtSecret:
      process.env.JWT_SECRET ??
      "dev-insecure-secret-change-me",
    clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
    githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  };
}
