const key = "code-editor:workspaceId";

export function getWorkspaceId() {
  try {
    const v = localStorage.getItem(key);
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

export function setWorkspaceId(id) {
  try {
    if (!id) localStorage.removeItem(key);
    else localStorage.setItem(key, String(id));
  } catch {
    // ignore
  }
}

