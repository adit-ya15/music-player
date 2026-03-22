export async function retry(fn, times = 3, options = {}) {
  const {
    delayMs = 0,
    onError,
  } = options;

  let lastError;

  for (let i = 0; i < times; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastError = err;
      try {
        onError?.(err, i);
      } catch {
        // ignore
      }
      if (delayMs > 0 && i < times - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw lastError ?? new Error('All retries failed');
}
