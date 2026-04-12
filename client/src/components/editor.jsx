import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { MonacoBinding } from "y-monaco";
import "../monaco/setup";
import socket from "../socket";
import { SocketIOProvider } from "../collab/SocketIOProvider";
import { saveFileContent } from "../api/files";
import { getAuthUser } from "../auth/session";

function languageForPath(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".md")) return "markdown";
  return "plaintext";
}

function getOrCreateUserIdentity(authUser) {
  if (authUser?.name) {
    const key = "code-editor:user:color";
    const palette = [
      "#60a5fa",
      "#34d399",
      "#f59e0b",
      "#f87171",
      "#a78bfa",
      "#fb7185",
      "#22c55e",
      "#38bdf8",
    ];
    const stored = localStorage.getItem(key);
    const color =
      stored && palette.includes(stored)
        ? stored
        : palette[Math.floor(Math.random() * palette.length)];
    localStorage.setItem(key, color);
    return { name: authUser.name, color };
  }

  const key = "code-editor:user";
  try {
    const existing = JSON.parse(localStorage.getItem(key) || "null");
    if (existing?.name && existing?.color) return existing;
  } catch {
    // ignore
  }

  const palette = [
    "#60a5fa",
    "#34d399",
    "#f59e0b",
    "#f87171",
    "#a78bfa",
    "#fb7185",
    "#22c55e",
    "#38bdf8",
  ];
  const name = `User-${Math.random().toString(16).slice(2, 6)}`;
  const color = palette[Math.floor(Math.random() * palette.length)];
  const created = { name, color };
  localStorage.setItem(key, JSON.stringify(created));
  return created;
}

const Editor = ({ filePath, authUser }) => {
  const editorRef = useRef(null);
  const bindingRef = useRef(null);
  const collabRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error

  const userIdentity = useMemo(
    () => getOrCreateUserIdentity(authUser ?? getAuthUser()),
    [authUser],
  );
  const language = useMemo(() => languageForPath(filePath), [filePath]);

  const attachBinding = useCallback(() => {
    const editor = editorRef.current;
    const collab = collabRef.current;
    if (!editor || !collab) return;
    const model = editor.getModel();
    if (!model) return;

    bindingRef.current?.destroy();
    const ytext = collab.doc.getText("content");
    bindingRef.current = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      collab.awareness,
    );
  }, []);

  useEffect(() => {
    // Cleanup old file session
    bindingRef.current?.destroy();
    bindingRef.current = null;

    if (collabRef.current) {
      collabRef.current.provider.destroy();
      collabRef.current.doc.destroy();
      collabRef.current = null;
    }

    if (!filePath) return;

    if (!authUser?.name) return;

    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    awareness.setLocalStateField("user", userIdentity);
    const provider = new SocketIOProvider({
      socket,
      room: filePath,
      doc,
      awareness,
    });
    provider.connect();

    const updateUsers = () => {
      const list = Array.from(awareness.getStates().values())
        .map((s) => s?.user)
        .filter(Boolean);
      setUsers(list);
    };
    awareness.on("change", updateUsers);
    awareness.on("update", updateUsers);
    updateUsers();

    collabRef.current = { doc, awareness, provider };
    attachBinding();

    return () => {
      awareness.off("change", updateUsers);
      awareness.off("update", updateUsers);
    };
  }, [attachBinding, authUser, filePath, userIdentity]);

  const handleSave = async () => {
    if (!filePath) return;
    const collab = collabRef.current;
    if (!collab) return;
    try {
      setSaveState("saving");
      const content = collab.doc.getText("content").toString();
      await saveFileContent(filePath, content);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 800);
    } catch (err) {
      console.error(err);
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 1200);
    }
  };

  const handleRun = () => {
    if (!filePath) return;
    const rel = String(filePath).replace(/^\/+/, "");
    const lower = rel.toLowerCase();
    let suggested = "";
    if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
      suggested = `node ./${rel}`;
    } else if (lower.endsWith(".ts")) {
      suggested = `npx tsx ./${rel}`;
    } else if (lower.endsWith(".py")) {
      suggested = `python3 ./${rel}`;
    } else if (lower.endsWith(".sh")) {
      suggested = `bash ./${rel}`;
    } else {
      suggested = "npm run dev";
    }

    const cmd = window.prompt("Run command", suggested);
    if (!cmd) return;
    socket.emit("terminal:run", { cmd });
  };

  if (!filePath) {
    return (
      <div className="h-full w-full p-4 text-sm text-slate-300">
        Select a file from the tree to start editing.
      </div>
    );
  }

  if (!authUser?.name) {
    return (
      <div className="h-full w-full p-4 text-sm text-slate-300">
        Sign in to collaborate and save changes.
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-8 items-center justify-between gap-3 border-b border-black/30 bg-[#1e1e1e] px-3 text-xs text-slate-300">
        <div className="min-w-0 flex-1 truncate">{filePath}</div>
        <div className="flex items-center gap-2">
          <div
            className="hidden max-w-[420px] items-center gap-1 overflow-hidden md:flex"
            title={users.map((u) => u.name).join(", ")}
          >
            {users.slice(0, 5).map((u) => (
              <div
                key={u.name}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: u.color }}
                />
                <span className="max-w-32 truncate text-slate-200">
                  {u.name}
                </span>
              </div>
            ))}
            {users.length > 5 && (
              <span className="ml-1 text-slate-300">+{users.length - 5}</span>
            )}
          </div>
          <button
            onClick={handleRun}
            className="rounded border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/10"
            title="Run command in terminal"
          >
            Run
          </button>
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="rounded border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            title="Save to disk"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? "Error"
                  : "Save"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <MonacoEditor
          height="100%"
          width="100%"
          path={filePath}
          defaultLanguage={language}
          theme="vs-dark"
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            tabSize: 2,
          }}
          onMount={(editor) => {
            editorRef.current = editor;
            editor.onDidChangeModel(() => attachBinding());
            attachBinding();
          }}
        />
      </div>
    </div>
  );
};

export default Editor;
