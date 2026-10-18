const PROTOCOL_VERSION = 1;

const MessageTypes = {
  // Client to Server
  SESSION_START: 'session.start',
  SESSION_STOP: 'session.stop',
  
  // Server to Client
  SESSION_READY: 'session.ready',
  SESSION_ENDED: 'session.ended',
  TRANSCRIPT_PARTIAL: 'transcript.partial',
  TRANSCRIPT_FINAL: 'transcript.final',
  TRANSLATION_FINAL: 'translation.final',
  ERROR: 'error',
  METRICS: 'metrics',
};

const ErrorCodes = {
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  UNSUPPORTED_LANGUAGE: 'UNSUPPORTED_LANGUAGE',
  UNSUPPORTED_AUDIO_FORMAT: 'UNSUPPORTED_AUDIO_FORMAT',
  SESSION_NOT_INITIALIZED: 'SESSION_NOT_INITIALIZED',
  SESSION_ALREADY_ACTIVE: 'SESSION_ALREADY_ACTIVE',
  MAX_SESSIONS_EXCEEDED: 'MAX_SESSIONS_EXCEEDED',
  QUEUE_OVERLOAD: 'QUEUE_OVERLOAD',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

function createSessionReadyMessage(sessionId) {
  return JSON.stringify({
    type: MessageTypes.SESSION_READY,
    sessionId,
    protocolVersion: PROTOCOL_VERSION,
  });
}

function createSessionEndedMessage(sessionId, reason = 'normal_closure') {
  return JSON.stringify({
    type: MessageTypes.SESSION_ENDED,
    sessionId,
    reason,
  });
}

function createPartialTranscriptMessage(sequence, text) {
  return JSON.stringify({
    type: MessageTypes.TRANSCRIPT_PARTIAL,
    sequence,
    text,
  });
}

function createFinalTranscriptMessage(sequence, text) {
  return JSON.stringify({
    type: MessageTypes.TRANSCRIPT_FINAL,
    sequence,
    text,
  });
}

function createFinalTranslationMessage(sequence, sourceText, translatedText, sourceLanguage, targetLanguage, latencyMetrics = null) {
  const payload = {
    type: MessageTypes.TRANSLATION_FINAL,
    sequence,
    sourceText,
    translatedText,
    sourceLanguage,
    targetLanguage,
  };
  if (latencyMetrics) {
    payload.latencyMetrics = latencyMetrics;
  }
  return JSON.stringify(payload);
}

function createErrorMessage(code, message) {
  return JSON.stringify({
    type: MessageTypes.ERROR,
    code,
    message,
  });
}

function createMetricsMessage(metrics) {
  return JSON.stringify({
    type: MessageTypes.METRICS,
    metrics,
  });
}

module.exports = {
  PROTOCOL_VERSION,
  MessageTypes,
  ErrorCodes,
  createSessionReadyMessage,
  createSessionEndedMessage,
  createPartialTranscriptMessage,
  createFinalTranscriptMessage,
  createFinalTranslationMessage,
  createErrorMessage,
  createMetricsMessage,
};
