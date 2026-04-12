import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useEffect, useRef } from "react";
import socket from "../socket";

import "@xterm/xterm/css/xterm.css";

const Terminal = () => {
  const terminalRef = useRef(null);

  useEffect(() => {
    const term = new XTerminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: "monospace",
      fontSize: 16,
      cursorStyle: "bar",
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    term.focus();

    // 🔴 Sync terminal size with backend
    let raf = 0;
    const resize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          const { cols, rows } = term;
          socket.emit("terminal:resize", { cols, rows });
        } catch {
          // ignore
        }
      });
    };

    resize();
    window.addEventListener("resize", resize);

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resize())
        : null;
    if (ro && terminalRef.current) ro.observe(terminalRef.current);

    // 🔴 Send raw input (DO NOT MODIFY)
    term.onData((data) => {
      socket.emit("terminal:write", data);
    });

    // 🔴 Receive output
    const onTerminalData = (data) => {
      term.write(data);
    };

    socket.on("terminal:data", onTerminalData);

    return () => {
      if (ro) ro.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      socket.off("terminal:data", onTerminalData);
      term.dispose();
    };
  }, []);

  return (
    <div
      ref={terminalRef}
      id="terminal"
      className="h-full w-full bg-black"
    />
  );
};

export default Terminal;
