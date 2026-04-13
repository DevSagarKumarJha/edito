import { SERVER_URL } from "../config";

export async function signup({ email, name, password }) {
  const response = await fetch(`${SERVER_URL}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || "Signup failed");
  return result;
}

export async function login({ email, password }) {
  const response = await fetch(`${SERVER_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || "Login failed");
  return result;
}

export async function me(token) {
  const response = await fetch(`${SERVER_URL}/auth/me`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || "Failed to fetch profile");
  return result;
}

