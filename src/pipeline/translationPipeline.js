const { createSTTProvider } = require('../services/speechRecognition');
const { createTranslationProvider } = require('../services/translation');
const {
  createPartialTranscriptMessage,
  createFinalTranscriptMessage,
  createFinalTranslationMessage,
} = require('../websocket/protocol');
const logger = require('../utils/logger');

class TranslationPipeline {
  constructor(session) {
    this.session = session;
    this.sttProvider = createSTTProvider(session.sessionId, {
      sourceLanguage: session.sourceLanguage,
      sampleRate: session.audioFormat.sampleRate,
    });
    this.translationProvider = createTranslationProvider();

    this.lastAudioReceivedAt = Date.now();
    this.isDestroyed = false;

    this.setupListeners();
  }

  setupListeners() {
    // 1. Partial transcript event: Stream directly to mobile client for zero-latency subtitles
    this.sttProvider.on('partial', ({ text }) => {
      if (this.isDestroyed || !this.session.ws || this.session.ws.readyState !== 1) return;

      const seq = this.session.sequence;
      this.session.ws.send(createPartialTranscriptMessage(seq, text));
    });

    // 2. Final transcript event: Detected stable phrase / utterance boundary
    this.sttProvider.on('final', async ({ text, timestamp }) => {
      if (this.isDestroyed || !this.session.ws || this.session.ws.readyState !== 1) return;

      const sttFinalizedAt = timestamp || Date.now();
      const sequence = this.session.nextSequence();

      // Emit finalized source transcript
      this.session.ws.send(createFinalTranscriptMessage(sequence, text));

      // 3. Dispatch to Machine Translation engine
      try {
        const translatedText = await this.translationProvider.translate(
          text,
          this.session.sourceLanguage,
          this.session.targetLanguage
        );

        const translationCompletedAt = Date.now();

        // 4. Calculate stage-by-stage latency metrics
        const latencyMetrics = this.session.metrics.recordSegmentLatency({
          sequence,
          audioServerReceivedAt: this.lastAudioReceivedAt,
          sttFinalizedAt,
          translationCompletedAt,
        });

        // 5. Emit translated final result to mobile client
        if (!this.isDestroyed && this.session.ws && this.session.ws.readyState === 1) {
          this.session.ws.send(
            createFinalTranslationMessage(
              sequence,
              text,
              translatedText,
              this.session.sourceLanguage,
              this.session.targetLanguage,
              latencyMetrics
            )
          );
        }
      } catch (err) {
        logger.error('Translation error in pipeline', {
          sessionId: this.session.sessionId,
          sequence,
          error: err.message,
        });
      }
    });
  }

  feedAudio(chunk) {
    if (this.isDestroyed) return;
    this.lastAudioReceivedAt = Date.now();
    this.sttProvider.writeChunk(chunk);
  }

  finalize() {
    if (this.isDestroyed) return;
    this.sttProvider.finalize();
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.sttProvider.destroy();
  }
}

module.exports = TranslationPipeline;
