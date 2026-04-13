import { useEffect, useMemo, useRef, useState } from "react";
import Terminal from "./components/terminal";
import FileTree from "./components/tree";
import socket, { setSocketAuthToken } from "./socket";
import Editor from "./components/editor";
import { createEmptyFile, createFolder, fetchFileTree } from "./api/files";
import { login, signup } from "./api/auth";
import {FaFolderPlus, FaFileMedical} from 'react-icons/fa' 
import { attachWorkspace, createWorkspace, listWorkspaces, selectWorkspace } from "./api/workspaces";
import { getWorkspaceId, setWorkspaceId } from "./workspaces/session";
import {
  getAuthToken,
  getAuthUser,
  setAuthToken,
  setAuthUser,
} from "./auth/session";

function basename(p) {
  const s = String(p || "");
  if (!s) return "";
  const parts = s.split("/");
  return parts[parts.length - 1] || s;
}

function languageLabel(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "TypeScript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "JavaScript";
  if (lower.endsWith(".json")) return "JSON";
  if (lower.endsWith(".html")) return "HTML";
  if (lower.endsWith(".css")) return "CSS";
  if (lower.endsWith(".md")) return "Markdown";
  return "Plain Text";
}

function dirname(p) {
  const s = String(p || "");
  if (!s) return "";
  const idx = s.lastIndexOf("/");
  return idx <= 0 ? "" : s.slice(0, idx);
}

function App() {
  const [fileTree, setFileTree] = useState({});
  const [activePath, setActivePath] = useState("");
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceIdState] = useState(() => getWorkspaceId());
  const [panelOpen, setPanelOpen] = useState(true);
  const [activePanel, setActivePanel] = useState("terminal"); // terminal | output | problems
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const raw = localStorage.getItem("layout:sidebarWidth");
    const n = Number(raw);
    return Number.isFinite(n) && n >= 180 && n <= 520 ? n : 288;
  });
  const [panelHeight, setPanelHeight] = useState(() => {
    const raw = localStorage.getItem("layout:panelHeight");
    const n = Number(raw);
    return Number.isFinite(n) && n >= 140 && n <= 520 ? n : 256;
  });
  const dragRef = useRef({ type: null, startX: 0, startY: 0, start: 0 });
  const [authUser, setAuthUserState] = useState(() => getAuthUser());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const getFileTree = async () => {
    const tree = await fetchFileTree();
    setFileTree(tree);
  };

  useEffect(() => {
    async function fetchData() {
      await getFileTree();
    }
    fetchData();
  }, []);

  useEffect(() => {
    socket.on("file:refresh", getFileTree);
    return () => socket.off("file:refresh", getFileTree);
  }, []);

  useEffect(() => {
    setSocketAuthToken(getAuthToken());
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!authUser) {
        setWorkspaces([]);
        setWorkspaceId("");
        setWorkspaceIdState("");
        return;
      }
      try {
        const { workspaces: list, activeId } = await listWorkspaces();
        const safeList = Array.isArray(list) ? list : [];
        setWorkspaces(safeList);
        const stored = getWorkspaceId();
        const desired =
          stored && safeList.some((w) => w?.id === stored) ? stored : activeId || "";
        setWorkspaceId(desired);
        setWorkspaceIdState(desired);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !workspaceId) return;
    const select = () => socket.emit("workspace:select", { id: workspaceId });
    if (socket.connected) select();
    socket.on("connect", select);
    return () => socket.off("connect", select);
  }, [authUser, workspaceId]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "auth:github") return;
      if (!data.token) return;
      setAuthToken(data.token);
      setAuthUser(data.user || null);
      setAuthUserState(data.user || null);
      setSocketAuthToken(data.token);
      setAuthOpen(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    localStorage.setItem("layout:sidebarWidth", String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem("layout:panelHeight", String(panelHeight));
  }, [panelHeight]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.type) return;
      if (dragRef.current.type === "sidebar") {
        const next = dragRef.current.start + (e.clientX - dragRef.current.startX);
        setSidebarWidth(Math.min(520, Math.max(180, next)));
        return;
      }
      if (dragRef.current.type === "panel") {
        const next = dragRef.current.start + (dragRef.current.startY - e.clientY);
        setPanelHeight(Math.min(520, Math.max(140, next)));
      }
    };
    const onUp = () => {
      dragRef.current.type = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const activeFileName = useMemo(() => basename(activePath) || "Welcome", [activePath]);
  const activeLanguage = useMemo(() => languageLabel(activePath), [activePath]);
  const activeDir = useMemo(() => dirname(activePath), [activePath]);

  const handleSelectWorkspace = async (nextId) => {
    if (!authUser) return;
    if (!nextId) return;
    try {
      await selectWorkspace(nextId);
      setWorkspaceId(nextId);
      setWorkspaceIdState(nextId);
      socket.emit("workspace:select", { id: nextId });
      setActivePath("");
      await getFileTree();
    } catch (err) {
      console.error(err);
      window.alert("Failed to switch workspace");
    }
  };

  const handleNewWorkspace = async () => {
    if (!authUser) return;
    const name = window.prompt("Workspace name", "My Workspace");
    if (!name) return;
    try {
      await createWorkspace(name);
      const { workspaces: list, activeId } = await listWorkspaces();
      const safeList = Array.isArray(list) ? list : [];
      setWorkspaces(safeList);
      if (activeId) await handleSelectWorkspace(activeId);
    } catch (err) {
      console.error(err);
      window.alert("Failed to create workspace");
    }
  };

  const handleAttachWorkspace = async () => {
    if (!authUser) return;
    const rootPath = window.prompt("Absolute folder path to attach");
    if (!rootPath) return;
    const name = window.prompt("Workspace name (optional)", "");
    try {
      await attachWorkspace({ path: rootPath, name });
      const { workspaces: list, activeId } = await listWorkspaces();
      const safeList = Array.isArray(list) ? list : [];
      setWorkspaces(safeList);
      if (activeId) await handleSelectWorkspace(activeId);
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Failed to attach workspace");
    }
  };

  const handleNewFile = async () => {
    const suggested = activeDir ? `${activeDir}/newFile.js` : "/newFile.js";
    const path = window.prompt("New file path (starts with /)", suggested);
    if (!path) return;
    try {
      await createEmptyFile(path);
      await getFileTree();
      setActivePath(path);
    } catch (err) {
      console.error(err);
      window.alert("Failed to create file");
    }
  };

  const handleNewFolder = async () => {
    const suggested = activeDir ? `${activeDir}/newFolder` : "/newFolder";
    const path = window.prompt("New folder path (starts with /)", suggested);
    if (!path) return;
    try {
      await createFolder(path);
      await getFileTree();
    } catch (err) {
      console.error(err);
      window.alert("Failed to create folder");
    }
  };

  const submitAuth = async () => {
    setAuthError("");
    try {
      const result =
        authMode === "signup"
          ? await signup({
              email: authEmail,
              name: authName,
              password: authPassword,
            })
          : await login({ email: authEmail, password: authPassword });
      setAuthToken(result.token);
      setAuthUser(result.user);
      setAuthUserState(result.user);
      setSocketAuthToken(result.token);
      setAuthOpen(false);
      setAuthPassword("");
    } catch (err) {
      setAuthError(err?.message || "Authentication failed");
    }
  };

  const signOut = () => {
    setAuthToken("");
    setAuthUser(null);
    setAuthUserState(null);
    setSocketAuthToken("");
    setWorkspaces([]);
    setWorkspaceId("");
    setWorkspaceIdState("");
  };

  const startGithubAuth = () => {
    setAuthError("");
    const url = `${import.meta.env.VITE_SERVER_URL ?? "http://localhost:9000"}/auth/github/start`;
    const width = 520;
    const height = 680;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    window.open(
      url,
      "github_oauth",
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#1e1e1e]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Activity Bar */}
        <aside className="w-12 shrink-0 border-r border-black/30 bg-[#333333]">
          <div className="flex h-full flex-col items-center py-2">
            <button
              className="flex h-12 w-12 items-center justify-center border-l-2 border-[#007acc] text-slate-100"
              title="Explorer"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M10 4H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h6V4zm10 0h-8v18h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
              </svg>
            </button>
          </div>
        </aside>

        {/* Side Bar */}
        <aside
          className="shrink-0 border-r border-black/30 bg-[#252526]"
          style={{ width: sidebarWidth }}
        >
          <div className="flex h-9 items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-300">
            <span>Explorer</span>
            <div className="flex items-center gap-1">
              {authUser && (
                <>
                  <select
                    value={workspaceId}
                    onChange={(e) => handleSelectWorkspace(e.target.value)}
                    className="mr-1 max-w-[160px] rounded border border-white/10 bg-[#1e1e1e] px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-200 outline-none"
                    title="Workspace"
                  >
                    {workspaces.length === 0 ? (
                      <option value="">(none)</option>
                    ) : (
                      workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    onClick={handleNewWorkspace}
                    className="rounded px-2 py-1 text-slate-300 hover:bg-white/5 hover:text-slate-100"
                    title="New Workspace"
                  >
                    +WS
                  </button>
                  <button
                    onClick={handleAttachWorkspace}
                    className="rounded px-2 py-1 text-slate-300 hover:bg-white/5 hover:text-slate-100"
                    title="Attach Folder as Workspace"
                  >
                    ⤒
                  </button>
                </>
              )}
              <button
                onClick={handleNewFile}
                className="rounded px-2 py-1 text-slate-300 hover:bg-white/5 hover:text-slate-100"
                title="New File"
              >
                <FaFileMedical />
              </button>
              <button
                onClick={handleNewFolder}
                className="rounded px-2 py-1 text-slate-300 hover:bg-white/5 hover:text-slate-100"
                title="New Folder"
              >
                <FaFolderPlus />
              </button>
              <button
                onClick={getFileTree}
                className="rounded px-2 py-1 text-slate-300 hover:bg-white/5 hover:text-slate-100"
                title="Refresh"
              >
                ↻
              </button>
            </div>
          </div>
          <div className="h-[calc(100%-36px)] overflow-auto px-2 pb-3">
            <FileTree
              tree={fileTree}
              onSelect={setActivePath}
              activePath={activePath}
            />
          </div>
        </aside>

        {/* Sidebar resize handle */}
        <div
          onMouseDown={(e) => {
            dragRef.current = {
              type: "sidebar",
              startX: e.clientX,
              startY: e.clientY,
              start: sidebarWidth,
            };
          }}
          className="w-1 cursor-col-resize bg-transparent hover:bg-[#007acc]"
          title="Resize Side Bar"
        />

        {/* Editor + Panel */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Tab strip */}
          <div className="flex h-9 items-center border-b border-black/30 bg-[#252526]">
            <div className="flex h-full items-center border-r border-black/30 bg-[#1e1e1e] px-3 text-sm text-slate-200">
              <span className="max-w-[360px] truncate">{activeFileName}</span>
            </div>
            <div className="ml-auto flex items-center gap-2 px-2 text-xs text-slate-300">
              <button
                onClick={() => setPanelOpen((v) => !v)}
                className="rounded px-2 py-1 hover:bg-white/5 hover:text-slate-100"
                title="Toggle Panel"
              >
                Panel
              </button>
            </div>
          </div>

          <section className="min-h-0 flex-1 bg-[#1e1e1e]">
            <Editor filePath={activePath} authUser={authUser} />
          </section>

          {panelOpen && (
            <section
              className="min-h-[180px] border-t border-black/30 bg-[#1e1e1e]"
              style={{ height: panelHeight }}
            >
              {/* Panel resize handle */}
              <div
                onMouseDown={(e) => {
                  dragRef.current = {
                    type: "panel",
                    startX: e.clientX,
                    startY: e.clientY,
                    start: panelHeight,
                  };
                }}
                className="h-1 cursor-row-resize bg-transparent hover:bg-[#007acc]"
                title="Resize Panel"
              />
              <div className="flex h-9 items-center justify-between border-b border-black/30 bg-[#252526] px-2 text-xs text-slate-200">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActivePanel("terminal")}
                    className={`rounded px-2 py-1 ${
                      activePanel === "terminal"
                        ? "bg-white/10 text-slate-100"
                        : "text-slate-300 hover:bg-white/5 hover:text-slate-100"
                    }`}
                  >
                    TERMINAL
                  </button>
                  <button
                    onClick={() => setActivePanel("problems")}
                    className={`rounded px-2 py-1 ${
                      activePanel === "problems"
                        ? "bg-white/10 text-slate-100"
                        : "text-slate-300 hover:bg-white/5 hover:text-slate-100"
                    }`}
                  >
                    PROBLEMS
                  </button>
                  <button
                    onClick={() => setActivePanel("output")}
                    className={`rounded px-2 py-1 ${
                      activePanel === "output"
                        ? "bg-white/10 text-slate-100"
                        : "text-slate-300 hover:bg-white/5 hover:text-slate-100"
                    }`}
                  >
                    OUTPUT
                  </button>
                </div>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="rounded px-2 py-1 text-slate-300 hover:bg-white/5 hover:text-slate-100"
                  title="Close Panel"
                >
                  ✕
                </button>
              </div>

              <div className="h-[calc(100%-40px)]">
                {activePanel === "terminal" ? (
                  <Terminal />
                ) : (
                  <div className="p-3 text-sm text-slate-400">
                    {activePanel === "problems"
                      ? "No problems have been detected."
                      : "Output is empty."}
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Status bar */}
      <footer className="flex h-6 items-center justify-between bg-[#007acc] px-3 text-[11px] text-white">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Ready</span>
        </div>
        <div className="flex items-center gap-3">
          {authUser ? (
            <button
              onClick={signOut}
              className="rounded px-2 py-0.5 hover:bg-white/20"
              title="Sign out"
            >
              {authUser.name}
            </button>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="rounded px-2 py-0.5 hover:bg-white/20"
              title="Sign in"
            >
              Sign in
            </button>
          )}
          <span className="opacity-90">{activeLanguage}</span>
          <button
            onClick={() => setPanelOpen(true)}
            className="rounded px-2 py-0.5 hover:bg-white/20"
            title="Open Panel"
          >
            Terminal
          </button>
        </div>
      </footer>

      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-md border border-white/10 bg-[#252526] p-4 text-slate-100 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">
                {authMode === "signup" ? "Create account" : "Sign in"}
              </div>
              <button
                onClick={() => setAuthOpen(false)}
                className="rounded px-2 py-1 text-slate-300 hover:bg-white/5 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="mb-3 flex gap-2 text-xs">
              <button
                onClick={() => setAuthMode("login")}
                className={`rounded px-3 py-1 ${
                  authMode === "login" ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode("signup")}
                className={`rounded px-3 py-1 ${
                  authMode === "signup" ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                Signup
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={startGithubAuth}
                className="flex w-full items-center justify-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current">
                  <path d="M8 0C3.58 0 0 3.73 0 8.33c0 3.68 2.29 6.8 5.47 7.9.4.08.55-.18.55-.4 0-.2-.01-.86-.01-1.56-2.01.45-2.53-.51-2.69-.98-.09-.24-.48-.98-.82-1.18-.28-.16-.68-.56-.01-.57.63-.01 1.08.6 1.23.85.72 1.25 1.87.9 2.33.69.07-.54.28-.9.51-1.11-1.78-.21-3.64-.92-3.64-4.09 0-.9.31-1.64.82-2.22-.08-.21-.36-1.05.08-2.18 0 0 .67-.22 2.2.85a7.28 7.28 0 0 1 2-.28c.68 0 1.36.1 2 .28 1.53-1.07 2.2-.85 2.2-.85.44 1.13.16 1.97.08 2.18.51.58.82 1.32.82 2.22 0 3.18-1.87 3.88-3.65 4.09.29.26.54.77.54 1.55 0 1.12-.01 2.03-.01 2.31 0 .22.15.49.55.4C13.71 15.13 16 12 16 8.33 16 3.73 12.42 0 8 0z" />
                </svg>
                Continue with GitHub
              </button>
              <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
                <div className="h-px flex-1 bg-white/10"></div>
                <span>or</span>
                <div className="h-px flex-1 bg-white/10"></div>
              </div>
              <input
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:border-[#007acc]"
              />
              {authMode === "signup" && (
                <input
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Name"
                  className="w-full rounded border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:border-[#007acc]"
                />
              )}
              <input
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                type="password"
                className="w-full rounded border border-white/10 bg-[#1e1e1e] px-3 py-2 text-sm outline-none focus:border-[#007acc]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAuth();
                }}
              />
              {authError && (
                <div className="text-xs text-red-300">{authError}</div>
              )}
              <button
                onClick={submitAuth}
                className="w-full rounded bg-[#007acc] px-3 py-2 text-sm font-semibold text-white hover:brightness-110"
              >
                {authMode === "signup" ? "Create account" : "Sign in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
