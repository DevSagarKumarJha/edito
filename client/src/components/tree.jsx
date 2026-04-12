import { useEffect, useMemo, useState } from "react";

function storageKey(path) {
  return `tree:open:${path || "/"}`;
}

function readOpenState(path, defaultValue) {
  try {
    const raw = localStorage.getItem(storageKey(path));
    if (raw === null) return defaultValue;
    return raw === "1";
  } catch {
    return defaultValue;
  }
}

function writeOpenState(path, isOpen) {
  try {
    localStorage.setItem(storageKey(path), isOpen ? "1" : "0");
  } catch {
    // ignore
  }
}

const FileTreeNode = ({
  fileName,
  nodes,
  onSelect,
  path,
  depth,
  activePath,
}) => {
  const isDir = !!nodes;
  const isActive = !isDir && activePath === path;
  const isRoot = depth === 0;
  const defaultOpen = isRoot;
  const [isOpen, setIsOpen] = useState(() => readOpenState(path, defaultOpen));

  useEffect(() => {
    if (isRoot) return;
    writeOpenState(path, isOpen);
  }, [isOpen, isRoot, path]);

  const children = useMemo(() => {
    if (!nodes) return [];
    return Object.keys(nodes).sort((a, b) => a.localeCompare(b));
  }, [nodes]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (isDir) {
          setIsOpen((v) => !v);
          return;
        }
        onSelect(path || "/");
      }}
      style={{ paddingLeft: depth * 12 }}
      className="select-none"
    >
      <p
        className={
          isDir
            ? "flex items-center gap-1 py-1 text-sm font-semibold text-slate-200 hover:text-slate-100"
            : `rounded px-2 py-1 text-sm text-slate-200 hover:bg-white/5 ${
                isActive ? "bg-white/10" : ""
              }`
        }
      >
        {isDir && (
          <span
            className={`inline-flex h-4 w-4 items-center justify-center text-slate-400 ${
              isOpen ? "rotate-90" : ""
            }`}
            style={{ transition: "transform 120ms ease" }}
            aria-hidden="true"
          >
            ▶
          </span>
        )}
        <span className="truncate">{fileName}</span>
      </p>
      {nodes && fileName !== "node_modules" && isOpen && (
        <ul className="mt-1">
          {children.map((child) => (
            <li key={child} className="my-0.5">
              <FileTreeNode
                onSelect={onSelect}
                path={path + "/" + child}
                fileName={child}
                nodes={nodes[child]}
                depth={depth + 1}
                activePath={activePath}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const FileTree = ({ tree, onSelect, activePath }) => {
  return (
    <FileTreeNode
      onSelect={onSelect}
      fileName="/"
      path=""
      nodes={tree}
      depth={0}
      activePath={activePath}
    />
  );
};
export default FileTree;
