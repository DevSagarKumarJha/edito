import jwt from "jsonwebtoken";

export function signToken({ jwtSecret, user }) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    jwtSecret,
    { expiresIn: "7d" },
  );
}

export function verifyToken({ jwtSecret, token }) {
  return jwt.verify(token, jwtSecret);
}

