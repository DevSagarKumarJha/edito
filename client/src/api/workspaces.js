import { SERVER_URL } from "../config";
import { getAuthToken } from "../auth/session";

function authHeaders(extra = {}) {
  const token = getAuthToken();
  return token ? { ...extra, authorization: `Bearer ${token}` } : { ...extra };
}

export async function listWorkspaces() {
  const response = await fetch(`${SERVER_URL}/workspaces`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Failed to list workspaces");
  return response.json(); // { workspaces, activeId }
}

export async function createWorkspace(name) {
  const response = await fetch(`${SERVER_URL}/workspaces/create`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Failed to create workspace");
  return response.json(); // { workspace }
}

export async function attachWorkspace({ path, name }) {
  const response = await fetch(`${SERVER_URL}/workspaces/attach`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ path, name }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = result?.error || "Failed to attach workspace";
    throw new Error(msg);
  }
  return result; // { workspace }
}

export async function selectWorkspace(id) {
  const response = await fetch(`${SERVER_URL}/workspaces/select`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error("Failed to select workspace");
  return true;
}

