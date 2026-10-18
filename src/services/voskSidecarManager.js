const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const env = require('../config/env');

let sidecarProcess = null;

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(600);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function ensureVoskSidecarRunning() {
  if ((env.STT_PROVIDER || '').toLowerCase() !== 'vosk') {
    return;
  }

  const port = env.VOSK_SIDECAR_PORT || 2700;
  const alreadyRunning = await isPortOpen(port);

  if (alreadyRunning) {
    logger.info('Vosk STT Sidecar is active and listening', { port });
    return;
  }

  logger.info('Spawning Vosk STT Sidecar Python process...', { port });
  const scriptPath = path.resolve(__dirname, 'vosk_server.py');

  const pythonCmd = process.platform === 'win32' ? 'py' : 'python3';
  const args = process.platform === 'win32' ? ['-3.12', scriptPath] : [scriptPath];

  try {
    sidecarProcess = spawn(pythonCmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    sidecarProcess.stdout.on('data', (d) => {
      logger.info(`[VoskSidecar] ${d.toString().trim()}`);
    });

    sidecarProcess.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) logger.info(`[VoskSidecar] ${msg}`);
    });

    sidecarProcess.on('exit', (code) => {
      logger.warn('Vosk STT Sidecar process exited', { code });
      sidecarProcess = null;
    });

    // Wait up to 6 seconds for port to open
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isPortOpen(port)) {
        logger.info('Vosk STT Sidecar successfully connected and listening', { port });
        return;
      }
    }
  } catch (err) {
    logger.error('Failed to spawn Vosk STT Sidecar', { error: err.message });
  }
}

function stopVoskSidecar() {
  if (sidecarProcess) {
    try {
      sidecarProcess.kill();
    } catch (_) {}
    sidecarProcess = null;
  }
}

module.exports = {
  ensureVoskSidecarRunning,
  stopVoskSidecar,
};
