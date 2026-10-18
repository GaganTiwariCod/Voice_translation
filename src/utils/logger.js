const env = require('../config/env');

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel = LEVELS[env.LOG_LEVEL.toLowerCase()] || LEVELS.info;

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  // Safe metadata without raw audio or leaking long sensitive data
  const safeMeta = { ...meta };
  if (safeMeta.audioBuffer) {
    safeMeta.audioBytes = safeMeta.audioBuffer.length;
    delete safeMeta.audioBuffer;
  }
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...safeMeta,
  });
}

const logger = {
  debug(message, meta) {
    if (currentLevel <= LEVELS.debug) {
      console.debug(formatLog('DEBUG', message, meta));
    }
  },
  info(message, meta) {
    if (currentLevel <= LEVELS.info) {
      console.info(formatLog('INFO', message, meta));
    }
  },
  warn(message, meta) {
    if (currentLevel <= LEVELS.warn) {
      console.warn(formatLog('WARN', message, meta));
    }
  },
  error(message, meta) {
    if (currentLevel <= LEVELS.error) {
      console.error(formatLog('ERROR', message, meta));
    }
  },
};

module.exports = logger;
