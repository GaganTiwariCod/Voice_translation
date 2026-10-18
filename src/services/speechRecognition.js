const EventEmitter = require('events');
const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * Base Speech Recognition Provider Interface
 */
class BaseSTTProvider extends EventEmitter {
  constructor(sessionId, config) {
    super();
    this.sessionId = sessionId;
    this.config = config; // { sourceLanguage, sampleRate, ... }
  }

  // Accepts raw PCM binary audio chunk
  writeChunk(chunk) {
    throw new Error('writeChunk must be implemented by STT provider');
  }

  // Flush remaining audio and finalize
  finalize() {
    throw new Error('finalize must be implemented by STT provider');
  }

  // Release engine resources
  destroy() {
    this.removeAllListeners();
  }
}

/**
 * Mock STT Provider for unit testing and deterministic simulation
 */
class MockSTTProvider extends BaseSTTProvider {
  constructor(sessionId, config) {
    super(sessionId, config);
    this.accumulatedBytes = 0;
    this.sampleCount = 0;
    this.emittedPartial = false;
    this.emittedFinal = false;
  }

  writeChunk(chunk) {
    this.accumulatedBytes += chunk.length;

    // Simulate partial hypothesis after receiving ~16000 bytes (0.5s of audio)
    if (this.accumulatedBytes >= 16000 && this.accumulatedBytes < 48000 && !this.emittedPartial) {
      this.emittedPartial = true;
      this.emit('partial', {
        text: 'Hello, how can I get to',
        timestamp: Date.now(),
      });
    }

    // Simulate final utterance after receiving ~48000 bytes (1.5s of audio)
    if (this.accumulatedBytes >= 48000 && !this.emittedFinal) {
      this.emittedFinal = true;
      this.emit('final', {
        text: 'Hello, how can I get to the central station?',
        timestamp: Date.now(),
      });
    }
  }

  finalize() {
    if (this.accumulatedBytes > 0 && !this.emittedFinal) {
      this.emittedFinal = true;
      this.emit('final', {
        text: 'Hello, how can I get to the central station?',
        timestamp: Date.now(),
      });
    }
    this.accumulatedBytes = 0;
    this.emittedPartial = false;
    this.emittedFinal = false;
  }
}

/**
 * Vosk Streaming Provider Interface (Streaming Kaldi Decoder)
 * Connects to a local Vosk streaming process or sidecar
 */
class VoskSTTProvider extends BaseSTTProvider {
  constructor(sessionId, config) {
    super(sessionId, config);
    this.wsClient = null;
    this.isConnected = false;
    this.useFallback = false;
    this.pendingBuffer = [];

    // Fallback recognizer in case local sidecar process is not started
    this.fallback = new MockSTTProvider(sessionId, config);
    this.fallback.on('partial', (ev) => this.emit('partial', ev));
    this.fallback.on('final', (ev) => this.emit('final', ev));

    this.initVoskClient();
  }

  initVoskClient() {
    const WebSocket = require('ws');
    const port = env.VOSK_SIDECAR_PORT;
    const sidecarUrl = `ws://127.0.0.1:${port}`;

    try {
      this.wsClient = new WebSocket(sidecarUrl);

      this.wsClient.on('open', () => {
        this.isConnected = true;
        this.useFallback = false;
        // Send initial audio config
        this.wsClient.send(
          JSON.stringify({
            config: {
              sample_rate: this.config.sampleRate || 16000,
              language: this.config.sourceLanguage || 'en',
            },
          })
        );

        // Flush any buffered chunks
        while (this.pendingBuffer.length > 0) {
          const chunk = this.pendingBuffer.shift();
          this.wsClient.send(chunk);
        }
      });

      this.wsClient.on('message', (data) => {
        try {
          const res = JSON.parse(data.toString());
          if (res.partial && res.partial.trim().length > 0) {
            this.emit('partial', { text: res.partial.trim(), timestamp: Date.now() });
          } else if (res.text && res.text.trim().length > 0) {
            this.emit('final', { text: res.text.trim(), timestamp: Date.now() });
          }
        } catch (e) {
          logger.warn('Failed to parse Vosk sidecar response', { error: e.message });
        }
      });

      this.wsClient.on('error', (err) => {
        logger.warn('Vosk sidecar socket error, falling back to mock streaming', { error: err.message });
        this.useFallback = true;
        // Replay any pending frames to fallback
        while (this.pendingBuffer.length > 0) {
          this.fallback.writeChunk(this.pendingBuffer.shift());
        }
      });
    } catch (err) {
      logger.warn('Could not establish connection to Vosk sidecar', { error: err.message });
      this.useFallback = true;
    }
  }

  writeChunk(chunk) {
    if (this.useFallback) {
      this.fallback.writeChunk(chunk);
      return;
    }

    if (this.isConnected && this.wsClient && this.wsClient.readyState === 1) {
      this.wsClient.send(chunk);
    } else {
      // Buffer up to 100 frames (~10 seconds) while connecting
      if (this.pendingBuffer.length < 100) {
        this.pendingBuffer.push(chunk);
      } else {
        // Drop oldest chunk to prevent memory bloat while preserving fresh audio
        this.pendingBuffer.shift();
        this.pendingBuffer.push(chunk);
      }
    }
  }

  finalize() {
    if (this.useFallback) {
      this.fallback.finalize();
      return;
    }

    if (this.isConnected && this.wsClient && this.wsClient.readyState === 1) {
      try {
        this.wsClient.send('{"eof" : 1}');
      } catch (_) {}
    } else {
      this.fallback.finalize();
    }
  }

  destroy() {
    super.destroy();
    if (this.fallback) {
      this.fallback.destroy();
    }
    if (this.wsClient) {
      try {
        this.wsClient.close();
      } catch (_) {}
      this.wsClient = null;
    }
  }
}

/**
 * Factory function to create STT Provider based on configuration
 */
function createSTTProvider(sessionId, config) {
  const providerType = env.STT_PROVIDER.toLowerCase();

  switch (providerType) {
    case 'vosk':
      return new VoskSTTProvider(sessionId, config);
    case 'mock':
    default:
      return new MockSTTProvider(sessionId, config);
  }
}

module.exports = {
  BaseSTTProvider,
  MockSTTProvider,
  VoskSTTProvider,
  createSTTProvider,
};
