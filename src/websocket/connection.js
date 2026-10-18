const { WebSocketServer, WebSocket } = require('ws');
const env = require('../config/env');
const logger = require('../utils/logger');
const { validateSessionStart } = require('../utils/validation');
const sessionManager = require('../sessions/sessionManager');
const {
  MessageTypes,
  ErrorCodes,
  createSessionReadyMessage,
  createSessionEndedMessage,
  createErrorMessage,
} = require('./protocol');

function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: env.WS_MAX_PAYLOAD_BYTES,
  });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || '127.0.0.1';
    let currentSession = null;

    logger.info('New WebSocket connection established', { clientIp });

    ws.on('message', (data, isBinary) => {
      // 1. Binary frames: Audio streaming
      if (isBinary) {
        if (!currentSession || !currentSession.isActive) {
          ws.send(createErrorMessage(ErrorCodes.SESSION_NOT_INITIALIZED, 'Audio frame received before session.start'));
          return;
        }

        currentSession.touch();
        currentSession.metrics.recordAudioFrame(data.length);

        // Enqueue into bounded audio queue
        try {
          currentSession.audioQueue.enqueue({
            timestamp: Date.now(),
            buffer: data,
          });

          // If pipeline is hooked, feed the audio frame
          if (currentSession.pipeline && typeof currentSession.pipeline.feedAudio === 'function') {
            currentSession.pipeline.feedAudio(data);
          }
        } catch (err) {
          logger.warn('Audio queue overload', { sessionId: currentSession.sessionId, error: err.message });
          ws.send(createErrorMessage(ErrorCodes.QUEUE_OVERLOAD, 'Audio buffer capacity exceeded'));
        }
        return;
      }

      // 2. Text frames: JSON control messages
      let message;
      try {
        message = JSON.parse(data.toString('utf8'));
      } catch (err) {
        ws.send(createErrorMessage(ErrorCodes.INVALID_PAYLOAD, 'Malformed JSON payload'));
        return;
      }

      if (!message || typeof message.type !== 'string') {
        ws.send(createErrorMessage(ErrorCodes.INVALID_PAYLOAD, 'Missing message type'));
        return;
      }

      switch (message.type) {
        case MessageTypes.SESSION_START: {
          if (currentSession && currentSession.isActive) {
            ws.send(createErrorMessage(ErrorCodes.SESSION_ALREADY_ACTIVE, 'A session is already active on this connection'));
            return;
          }

          const validation = validateSessionStart(message);
          if (!validation.valid) {
            ws.send(createErrorMessage(ErrorCodes.UNSUPPORTED_LANGUAGE, validation.error));
            return;
          }

          try {
            currentSession = sessionManager.createSession(validation.data, ws, clientIp);
            ws.send(createSessionReadyMessage(currentSession.sessionId));
          } catch (err) {
            logger.error('Failed to create session', { error: err.message });
            ws.send(createErrorMessage(ErrorCodes.INTERNAL_ERROR, err.message));
          }
          break;
        }

        case MessageTypes.SESSION_STOP: {
          if (!currentSession || !currentSession.isActive) {
            ws.send(createErrorMessage(ErrorCodes.SESSION_NOT_INITIALIZED, 'No active session to stop'));
            return;
          }

          const sessionId = currentSession.sessionId;
          sessionManager.destroySession(sessionId, 'client_stop');
          ws.send(createSessionEndedMessage(sessionId, 'client_requested'));
          currentSession = null;
          break;
        }

        case 'ping': {
          if (currentSession) {
            currentSession.touch();
          }
          try {
            ws.send(JSON.stringify({ type: 'pong' }));
          } catch (_) {}
          break;
        }

        default:
          ws.send(createErrorMessage(ErrorCodes.INVALID_PAYLOAD, `Unknown message type: ${message.type}`));
          break;
      }
    });

    ws.on('close', (code, reason) => {
      logger.info('WebSocket connection closed', {
        clientIp,
        code,
        reason: reason ? reason.toString() : 'none',
      });
      if (currentSession) {
        sessionManager.destroySession(currentSession.sessionId, 'socket_closed');
        currentSession = null;
      }
    });

    ws.on('error', (err) => {
      logger.error('WebSocket connection error', { clientIp, error: err.message });
      if (currentSession) {
        sessionManager.destroySession(currentSession.sessionId, 'socket_error');
        currentSession = null;
      }
    });
  });

  return wss;
}

module.exports = { setupWebSocketServer };
