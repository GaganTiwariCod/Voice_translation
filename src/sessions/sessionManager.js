const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const env = require('../config/env');
const logger = require('../utils/logger');
const BoundedQueue = require('../queues/boundedQueue');
const MetricsCollector = require('../services/metrics');
const TranslationPipeline = require('../pipeline/translationPipeline');

class Session {
  constructor(sessionId, config, ws, clientIp = '127.0.0.1') {
    this.sessionId = sessionId;
    this.clientIp = clientIp;
    this.sourceLanguage = config.sourceLanguage;
    this.targetLanguage = config.targetLanguage;
    this.audioFormat = config.audioFormat;
    this.ws = ws;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
    this.sequence = 0;
    this.isActive = true;

    // Bounded buffers
    this.audioQueue = new BoundedQueue(`audio-${sessionId}`, env.MAX_AUDIO_QUEUE_CHUNKS, 'drop_oldest');
    this.metrics = new MetricsCollector(sessionId);

    // Speech recognition & translation pipeline hooks (bound in later phases)
    this.pipeline = null;
  }

  touch() {
    this.lastActivityAt = Date.now();
  }

  nextSequence() {
    this.sequence += 1;
    return this.sequence;
  }

  isIdle(timeoutMs) {
    return Date.now() - this.lastActivityAt > timeoutMs;
  }

  close() {
    if (!this.isActive) return;
    this.isActive = false;
    if (this.pipeline && typeof this.pipeline.destroy === 'function') {
      try {
        this.pipeline.destroy();
      } catch (err) {
        logger.error('Error destroying pipeline during session close', { sessionId: this.sessionId, error: err.message });
      }
    }
    this.audioQueue.clear();
  }
}

class SessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> Session
    this.clientSessionCount = new Map(); // ip/clientKey -> count
    this.idleCheckerInterval = setInterval(() => this.checkIdleSessions(), 15000);
    if (this.idleCheckerInterval.unref) {
      this.idleCheckerInterval.unref();
    }
  }

  createSession(config, ws, clientIp = '127.0.0.1') {
    if (this.sessions.size >= env.MAX_CONCURRENT_SESSIONS) {
      throw new Error('MAX_CONCURRENT_SESSIONS_EXCEEDED');
    }

    const currentClientCount = this.clientSessionCount.get(clientIp) || 0;
    if (currentClientCount >= env.MAX_SESSIONS_PER_CLIENT) {
      throw new Error('CLIENT_SESSION_LIMIT_EXCEEDED');
    }

    const sessionId = uuidv4();
    const session = new Session(sessionId, config, ws, clientIp);
    session.pipeline = new TranslationPipeline(session);
    this.sessions.set(sessionId, session);
    this.clientSessionCount.set(clientIp, currentClientCount + 1);

    logger.info('Session created', {
      sessionId,
      sourceLanguage: config.sourceLanguage,
      targetLanguage: config.targetLanguage,
      clientIp,
    });

    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  destroySession(sessionId, reason = 'normal') {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.close();
    this.sessions.delete(sessionId);

    if (session.clientIp) {
      const count = this.clientSessionCount.get(session.clientIp) || 1;
      if (count <= 1) {
        this.clientSessionCount.delete(session.clientIp);
      } else {
        this.clientSessionCount.set(session.clientIp, count - 1);
      }
    }

    logger.info('Session destroyed', { sessionId, reason });
    return session;
  }

  checkIdleSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.isIdle(env.SESSION_IDLE_TIMEOUT_MS)) {
        logger.warn('Session timed out due to inactivity', { sessionId });
        if (session.ws && session.ws.readyState === 1) { // WebSocket.OPEN
          try {
            session.ws.close(1000, 'Session idle timeout');
          } catch (_) {}
        }
        this.destroySession(sessionId, 'idle_timeout');
      }
    }
  }

  shutdown() {
    clearInterval(this.idleCheckerInterval);
    for (const [sessionId] of this.sessions.entries()) {
      this.destroySession(sessionId, 'server_shutdown');
    }
  }
}

module.exports = new SessionManager();
