import { spawn } from "node:child_process";

const children = [];
let stopping = false;

function startScript(scriptName) {
  const command = process.platform === "win32"
    ? {
        file: process.env.ComSpec || "cmd.exe",
        args: ["/d", "/s", "/c", `npm run ${scriptName}`],
      }
    : {
        file: "npm",
        args: ["run", scriptName],
      };

  const child = spawn(command.file, command.args, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (stopping) {
      return;
    }

    if (code !== 0) {
      console.error(`\n[dev:all] ${scriptName} exited with code ${code}${signal ? ` (${signal})` : ""}`);
      shutdown();
      process.exitCode = code ?? 1;
      return;
    }

    console.error(`\n[dev:all] ${scriptName} exited unexpectedly.`);
    shutdown();
    process.exitCode = 1;
  });

  children.push(child);
}

function shutdown() {
  if (stopping) {
    return;
  }

  stopping = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

startScript("server");
startScript("dev");
