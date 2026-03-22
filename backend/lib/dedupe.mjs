// lib/dedupe.mjs

const inFlight = new Map();

export async function dedupe(key, fn) {
  if (inFlight.has(key)) return inFlight.get(key);

  const p = Promise.resolve()
    .then(fn)
    .finally(() => inFlight.delete(key));

  inFlight.set(key, p);
  return p;
}
