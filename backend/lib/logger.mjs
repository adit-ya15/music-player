function fmtMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  try {
    return ' ' + JSON.stringify(meta);
  } catch {
    return '';
  }
}

export const logger = {
  info(tag, message, meta) {
    console.log(`[Aura][${tag}] ${message}${fmtMeta(meta)}`);
  },
  warn(tag, message, meta) {
    console.warn(`[Aura][${tag}] ${message}${fmtMeta(meta)}`);
  },
  error(tag, message, meta) {
    console.error(`[Aura][${tag}] ${message}${fmtMeta(meta)}`);
  },
};
