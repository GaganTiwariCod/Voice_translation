const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  HOST: process.env.HOST || '0.0.0.0',
  WS_MAX_PAYLOAD_BYTES: parseInt(process.env.WS_MAX_PAYLOAD_BYTES, 10) || 1024 * 1024,
  SESSION_IDLE_TIMEOUT_MS: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS, 10) || 60000,
  MAX_SESSIONS_PER_CLIENT: parseInt(process.env.MAX_SESSIONS_PER_CLIENT, 10) || 2,
  MAX_CONCURRENT_SESSIONS: parseInt(process.env.MAX_CONCURRENT_SESSIONS, 10) || 20,

  EXPECTED_SAMPLE_RATE: parseInt(process.env.EXPECTED_SAMPLE_RATE, 10) || 16000,
  EXPECTED_CHANNELS: parseInt(process.env.EXPECTED_CHANNELS, 10) || 1,
  EXPECTED_ENCODING: process.env.EXPECTED_ENCODING || 'pcm_s16le',

  MAX_AUDIO_QUEUE_CHUNKS: parseInt(process.env.MAX_AUDIO_QUEUE_CHUNKS, 10) || 100,
  MAX_TRANSLATION_QUEUE_ITEMS: parseInt(process.env.MAX_TRANSLATION_QUEUE_ITEMS, 10) || 50,

  STT_PROVIDER: process.env.STT_PROVIDER || 'vosk',
  VOSK_SIDECAR_PORT: parseInt(process.env.VOSK_SIDECAR_PORT, 10) || 2700,
  VOSK_MODEL_PATH_EN: process.env.VOSK_MODEL_PATH_EN || './models/vosk-model-small-en-us-0.15',
  VOSK_MODEL_PATH_HI: process.env.VOSK_MODEL_PATH_HI || './models/vosk-model-small-hi-0.22',

  TRANSLATION_PROVIDER: process.env.TRANSLATION_PROVIDER || 'libretranslate',
  LIBRETRANSLATE_URL: process.env.LIBRETRANSLATE_URL || 'https://translate.argosopentech.com',
  LIBRETRANSLATE_API_KEY: process.env.LIBRETRANSLATE_API_KEY || '',

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

module.exports = env;
