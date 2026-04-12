import { verifyToken } from "./tokens.js";
import { findUserById } from "./store.js";

function parseBearer(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return "";
  return token;
}

export function createAuthMiddleware({ userDir, jwtSecret }) {
  return async function auth(req, _res, next) {
    const token = parseBearer(req);
    if (!token) {
      req.user = null;
      next();
      return;
    }
    try {
      const payload = verifyToken({ jwtSecret, token });
      const user = await findUserById({ userDir, id: payload.sub });
      req.user = user ? { id: user.id, email: user.email, name: user.name } : null;
    } catch {
      req.user = null;
    }
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

