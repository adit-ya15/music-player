export function getOrCreateUserId() {
  try {
    const existing = localStorage.getItem('aura-user-id');
    if (existing) return existing;

    const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem('aura-user-id', id);
    return id;
  } catch {
    return 'anonymous';
  }
}
