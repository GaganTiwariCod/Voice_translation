const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { setupWebSocketServer } = require('./websocket/connection');
const sessionManager = require('./sessions/sessionManager');

const server = http.createServer(app);

const { ensureVoskSidecarRunning, stopVoskSidecar } = require('./services/voskSidecarManager');

// Attach WebSocket streaming handler
const wss = setupWebSocketServer(server);

server.listen(env.PORT, env.HOST, async () => {
  logger.info(`Live Translator Server listening on http://${env.HOST}:${env.PORT}`, {
    port: env.PORT,
    host: env.HOST,
    sttProvider: env.STT_PROVIDER,
    translationProvider: env.TRANSLATION_PROVIDER,
  });

  await ensureVoskSidecarRunning();
});

function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  stopVoskSidecar();
  sessionManager.shutdown();
  wss.close(() => {
    logger.info('WebSocket server closed.');
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  });

  // Force close after 5 seconds if hanging
  setTimeout(() => {
    logger.error('Forcefully exiting after timeout');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = { server, wss };
