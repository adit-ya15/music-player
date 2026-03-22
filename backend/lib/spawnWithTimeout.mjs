import { spawn } from 'child_process';

export function spawnWithTimeout(bin, args, options = {}) {
  const {
    timeoutMs = 8000,
    cwd,
    env,
    stdio = ['ignore', 'pipe', 'pipe'],
  } = options;

  const proc = spawn(bin, args, {
    cwd,
    env,
    stdio,
    windowsHide: true,
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill('SIGKILL');
    } catch {
      // ignore
    }
  }, timeoutMs);

  const done = new Promise((resolve, reject) => {
    proc.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.once('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Process timeout after ${timeoutMs}ms`));
      } else {
        resolve({ code });
      }
    });
  });

  return { proc, done };
}
