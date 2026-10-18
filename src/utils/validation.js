const env = require('../config/env');

const SUPPORTED_LANGUAGES = new Set([
  'auto',
  'en',
  'en-US',
  'en-IN',
  'hi',
  'hi-IN',
  'bn',
  'bn-IN',
  'ta',
  'ta-IN',
  'te',
  'te-IN',
  'mr',
  'mr-IN',
  'gu',
  'gu-IN',
  'es',
  'es-ES',
  'fr',
  'fr-FR',
  'de',
  'de-DE',
]);

const SUPPORTED_ENCODINGS = new Set(['pcm_s16le']);
const SUPPORTED_SAMPLE_RATES = new Set([16000]);
const SUPPORTED_CHANNELS = new Set([1]);

function validateSessionStart(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be a JSON object' };
  }

  if (payload.type !== 'session.start') {
    return { valid: false, error: 'Invalid message type for starting session' };
  }

  if (payload.protocolVersion !== 1) {
    return { valid: false, error: 'Unsupported protocolVersion. Expected 1' };
  }

  if (!payload.sourceLanguage || typeof payload.sourceLanguage !== 'string') {
    return { valid: false, error: 'sourceLanguage is required and must be a string' };
  }

  if (!payload.targetLanguage || typeof payload.targetLanguage !== 'string') {
    return { valid: false, error: 'targetLanguage is required and must be a string' };
  }

  // Normalize language tags (e.g. en-US -> en-US or base en)
  const normSource = payload.sourceLanguage.trim();
  const normTarget = payload.targetLanguage.trim();

  if (!SUPPORTED_LANGUAGES.has(normSource) && !SUPPORTED_LANGUAGES.has(normSource.split('-')[0])) {
    return { valid: false, error: `Unsupported source language: ${normSource}` };
  }

  if (!SUPPORTED_LANGUAGES.has(normTarget) && !SUPPORTED_LANGUAGES.has(normTarget.split('-')[0])) {
    return { valid: false, error: `Unsupported target language: ${normTarget}` };
  }

  if (normSource === normTarget) {
    return { valid: false, error: 'Source and target languages cannot be identical' };
  }

  if (!payload.audioFormat || typeof payload.audioFormat !== 'object') {
    return { valid: false, error: 'audioFormat configuration is required' };
  }

  const { encoding, sampleRate, channels } = payload.audioFormat;

  if (!SUPPORTED_ENCODINGS.has(encoding)) {
    return { valid: false, error: `Unsupported audio encoding: ${encoding}. Expected: pcm_s16le` };
  }

  if (!SUPPORTED_SAMPLE_RATES.has(sampleRate)) {
    return { valid: false, error: `Unsupported sample rate: ${sampleRate}. Expected: 16000` };
  }

  if (!SUPPORTED_CHANNELS.has(channels)) {
    return { valid: false, error: `Unsupported channels: ${channels}. Expected: 1 (mono)` };
  }

  return {
    valid: true,
    data: {
      sourceLanguage: normSource,
      targetLanguage: normTarget,
      audioFormat: { encoding, sampleRate, channels },
    },
  };
}

module.exports = {
  validateSessionStart,
  SUPPORTED_LANGUAGES,
};
