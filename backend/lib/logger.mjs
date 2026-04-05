function fmtMeta(meta) {
  if (!meta || typeof meta !== 'object') return '';
  try {
    return ' ' + JSON.stringify(meta);
  } catch {
    return '';
  }
}

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function resolveLogLevel() {
  const raw = String(process.env.AURA_LOG_LEVEL || process.env.LOG_LEVEL || 'info')
    .trim()
    .toLowerCase();
  return Object.prototype.hasOwnProperty.call(LOG_LEVELS, raw) ? raw : 'info';
}

let currentLogLevel = resolveLogLevel();

function shouldLog(level) {
  const threshold = LOG_LEVELS[currentLogLevel] ?? LOG_LEVELS.info;
  const requested = LOG_LEVELS[level] ?? LOG_LEVELS.info;
  return requested <= threshold;
}

export const logger = {
  info(tag, message, meta) {
    if (!shouldLog('info')) return;
    console.log(`[Aura][${tag}] ${message}${fmtMeta(meta)}`);
  },
  warn(tag, message, meta) {
    if (!shouldLog('warn')) return;
    console.warn(`[Aura][${tag}] ${message}${fmtMeta(meta)}`);
  },
  error(tag, message, meta) {
    if (!shouldLog('error')) return;
    console.error(`[Aura][${tag}] ${message}${fmtMeta(meta)}`);
  },
  debug(tag, message, meta) {
    if (!shouldLog('debug')) return;
    console.debug(`[Aura][${tag}] ${message}${fmtMeta(meta)}`);
  },
  setLevel(level) {
    const next = String(level || '').trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(LOG_LEVELS, next)) {
      currentLogLevel = next;
    }
  }
};
