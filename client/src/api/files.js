import { SERVER_URL } from "../config";
import { getAuthToken } from "../auth/session";
import { getWorkspaceId } from "../workspaces/session";

function authHeaders(extra = {}) {
  const token = getAuthToken();
  const workspaceId = token ? getWorkspaceId() : "";
  const headers = token ? { ...extra, authorization: `Bearer ${token}` } : { ...extra };
  return workspaceId ? { ...headers, "x-workspace-id": workspaceId } : headers;
}

export async function fetchFileTree() {
  const response = await fetch(`${SERVER_URL}/files`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch file tree");
  const result = await response.json();
  return result.tree;
}

export async function fetchFileContent(path) {
  const response = await fetch(`${SERVER_URL}/file?path=${encodeURIComponent(path)}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch file");
  const result = await response.json();
  return result.content;
}

export async function saveFileContent(path, content) {
  const response = await fetch(`${SERVER_URL}/file?path=${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error("Failed to save file");
  return true;
}

export async function createFolder(path) {
  const response = await fetch(`${SERVER_URL}/folder?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error("Failed to create folder");
  return true;
}

export async function createEmptyFile(path) {
  return saveFileContent(path, "");
}
