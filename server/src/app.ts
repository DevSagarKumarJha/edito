import express from "express";
import cors from "cors";
import { createFilesRouter } from "./files/router.ts";
import { createAuthRouter } from "./auth/router.ts";
import { createAuthMiddleware, requireAuth } from "./auth/middleware.ts";
import { createWorkspacesRouter } from "./workspaces/router.ts";

export function createApp({
  corsOrigin,
  userDir,
  jwtSecret,
  clientUrl,
  githubClientId,
  githubClientSecret,
  serverRoot,
}) {
  const app = express();
  app.use(express.json());
  app.use(
    cors({
      origin: corsOrigin,
    }),
  );

  app.use(createAuthMiddleware({ userDir, jwtSecret }));
  app.use(
    createAuthRouter({
      userDir,
      jwtSecret,
      clientUrl,
      githubClientId,
      githubClientSecret,
    }),
  );

  app.use(
    createWorkspacesRouter({
      userDir,
      requireAuth,
      serverRoot,
    }),
  );

  // Require auth for any writes (create/update)
  app.use(
    createFilesRouter({
      userDir,
      requireWriteAuth: requireAuth,
    }),
  );

  return app;
}
