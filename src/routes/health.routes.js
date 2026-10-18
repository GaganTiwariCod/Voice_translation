const express = require('express');
const sessionManager = require('../sessions/sessionManager');
const env = require('../config/env');

const router = express.Router();

router.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'ok',
    service: 'live-translator-server',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    activeSessions: sessionManager.sessions.size,
    configuration: {
      port: env.PORT,
      sttProvider: env.STT_PROVIDER,
      translationProvider: env.TRANSLATION_PROVIDER,
      sampleRate: env.EXPECTED_SAMPLE_RATE,
      encoding: env.EXPECTED_ENCODING,
    },
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
  });
});

module.exports = router;
