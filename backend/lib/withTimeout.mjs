// lib/withTimeout.mjs

export function withTimeout(promise, ms = 8000) {
  const timeoutMs = Number(ms);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error('Timeout'));
      }, timeoutMs);
    }),
  ]);
}
