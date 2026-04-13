import path from "path";
import pty from "node-pty";

export function createPtyProcess({ shell, userDir, env }) {
  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cwd: path.resolve(userDir),
    env,
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log("PTY exited with code:", exitCode);
  });
  return ptyProcess;
}
