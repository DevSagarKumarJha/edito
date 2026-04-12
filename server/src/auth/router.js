import express from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import {
  createUser,
  findUserByEmail,
  findUserByGithubId,
  findUserById,
  updateUser,
} from "./store.js";
import { signToken } from "./tokens.js";

function isValidEmail(email) {
  return typeof email === "string" && email.includes("@") && email.length <= 200;
}

function isValidName(name) {
  return typeof name === "string" && name.trim().length >= 2 && name.length <= 40;
}

function isValidPassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 200;
}

function absoluteUrl(base, pathname) {
  const u = new URL(base);
  u.pathname = pathname;
  u.search = "";
  u.hash = "";
  return u.toString();
}

function normalizeGithubEmail(primaryEmail, fallbackEmail) {
  const email = primaryEmail || fallbackEmail || "";
  return typeof email === "string" ? email : "";
}

function getRequestBaseUrl(req) {
  const protoHeader = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader)
    ? String(Array.isArray(protoHeader) ? protoHeader[0] : protoHeader).split(",")[0].trim()
    : req.protocol || "http";
  return `${proto}://${hostHeader}`;
}

const githubStates = new Map(); // state -> { createdAt }
function putState(state) {
  githubStates.set(state, { createdAt: Date.now() });
}
function consumeState(state) {
  const v = githubStates.get(state);
  githubStates.delete(state);
  if (!v) return false;
  return Date.now() - v.createdAt < 5 * 60 * 1000;
}

export function createAuthRouter({
  userDir,
  jwtSecret,
  clientUrl,
  githubClientId,
  githubClientSecret,
}) {
  const router = express.Router();

  router.post("/auth/signup", async (req, res) => {
    try {
      const { email, name, password } = req.body ?? {};
      const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : email;
      if (!isValidEmail(normalizedEmail) || !isValidName(name) || !isValidPassword(password)) {
        res.status(400).json({ error: "Invalid input" });
        return;
      }

      const existing = await findUserByEmail({ userDir, email: normalizedEmail });
      if (existing) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = {
        id: randomUUID(),
        email: normalizedEmail,
        name: name.trim(),
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      await createUser({ userDir, user });

      const token = signToken({ jwtSecret, user });
      res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Signup failed" });
    }
  });

  router.post("/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : email;
      if (!isValidEmail(normalizedEmail) || !isValidPassword(password)) {
        res.status(400).json({ error: "Invalid input" });
        return;
      }

      const user = await findUserByEmail({ userDir, email: normalizedEmail });
      if (!user) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const token = signToken({ jwtSecret, user });
      res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  router.get("/auth/me", async (req, res) => {
    // relies on auth middleware setting req.user
    if (!req.user) {
      res.status(200).json({ user: null });
      return;
    }
    const user = await findUserById({ userDir, id: req.user.id });
    if (!user) {
      res.status(200).json({ user: null });
      return;
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  });

  router.get("/auth/github/start", async (_req, res) => {
    if (!githubClientId) {
      res.status(500).json({ error: "GitHub OAuth not configured" });
      return;
    }
    const state = randomUUID();
    putState(state);

    const redirectUri = `${getRequestBaseUrl(_req)}/auth/github/callback`;
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", githubClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  });

  router.get("/auth/github/callback", async (req, res) => {
    try {
      if (!githubClientId || !githubClientSecret) {
        res.status(500).send("GitHub OAuth not configured");
        return;
      }

      const code = String(req.query.code ?? "");
      const state = String(req.query.state ?? "");
      if (!code || !state || !consumeState(state)) {
        res.status(400).send("Invalid OAuth state");
        return;
      }

      const redirectUri = `${getRequestBaseUrl(req)}/auth/github/callback`;

      const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          client_id: githubClientId,
          client_secret: githubClientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });
      const tokenJson = await tokenResp.json();
      const accessToken = tokenJson?.access_token;
      if (!accessToken) {
        res.status(401).send("GitHub token exchange failed");
        return;
      }

      const ghUserResp = await fetch("https://api.github.com/user", {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/vnd.github+json",
        },
      });
      const ghUser = await ghUserResp.json();
      const githubId = String(ghUser?.id ?? "");
      const githubLogin = String(ghUser?.login ?? "");
      const githubName = String(ghUser?.name ?? "") || githubLogin;
      const githubEmail = normalizeGithubEmail(ghUser?.email, "");

      // If email isn't included, fetch from /user/emails
      let email = githubEmail;
      if (!email) {
        const emailsResp = await fetch("https://api.github.com/user/emails", {
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: "application/vnd.github+json",
          },
        });
        const emails = await emailsResp.json();
        if (Array.isArray(emails)) {
          const primary = emails.find((e) => e?.primary && e?.verified);
          const anyVerified = emails.find((e) => e?.verified);
          email = String(primary?.email ?? anyVerified?.email ?? "");
        }
      }

      if (!githubId) {
        res.status(401).send("GitHub user fetch failed");
        return;
      }

      // Find or create user
      let user =
        (await findUserByGithubId({ userDir, githubId })) ??
        (email ? await findUserByEmail({ userDir, email: String(email).trim().toLowerCase() }) : null);

      if (!user) {
        user = {
          id: randomUUID(),
          email: (email || `${githubLogin}@users.noreply.github.com`).trim().toLowerCase(),
          name: githubName || `gh:${githubLogin}`,
          passwordHash: "",
          githubId,
          createdAt: new Date().toISOString(),
        };
        await createUser({ userDir, user });
      } else if (!user.githubId) {
        user = await updateUser({ userDir, id: user.id, patch: { githubId } });
      }

      const jwt = signToken({ jwtSecret, user });
      const callbackUrl = new URL("/auth-callback.html", clientUrl);
      callbackUrl.hash = `token=${encodeURIComponent(jwt)}&name=${encodeURIComponent(
        user.name,
      )}&email=${encodeURIComponent(user.email)}`;
      res.redirect(callbackUrl.toString());
    } catch (err) {
      console.error(err);
      res.status(500).send("GitHub OAuth failed");
    }
  });

  return router;
}
