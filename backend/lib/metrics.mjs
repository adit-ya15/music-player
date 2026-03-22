// lib/metrics.mjs

const counters = new Map();

export const metrics = {
  increment(name, by = 1) {
    if (!name) return;
    const key = String(name);
    const inc = Number(by);
    counters.set(key, (counters.get(key) || 0) + (Number.isFinite(inc) ? inc : 1));
  },

  snapshot() {
    const out = {};
    for (const [k, v] of counters.entries()) out[k] = v;
    return out;
  },
};
