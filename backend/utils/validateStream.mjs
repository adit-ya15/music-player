// utils/validateStream.mjs
// Strict stream validation to avoid expired/mismatch URLs.

function getFetch() {
  if (typeof fetch === 'function') return fetch;
  throw new Error('Global fetch is not available (Node 18+ required)');
}

export async function isStreamAlive(url) {
  if (!url || typeof url !== 'string') return false;

  const f = getFetch();

  // Some CDNs block HEAD; try HEAD first per spec, then fall back to a tiny ranged GET.
  const tryOnce = async (method, headers) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await f(url, {
        method,
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      return !!res?.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };

  const headOk = await tryOnce('HEAD');
  if (headOk) return true;

  // Ranged GET to validate that the URL actually serves bytes.
  return await tryOnce('GET', { Range: 'bytes=0-0' });
}
