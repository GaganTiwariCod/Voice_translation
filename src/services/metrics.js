class MetricsCollector {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.audioFramesReceived = 0;
    this.totalAudioBytes = 0;
    this.transcriptCount = 0;
    this.translationCount = 0;
    this.latencies = []; // Array of { sequence, sttLatencyMs, translationLatencyMs, totalServerLatencyMs }
    this.sessionStartTime = Date.now();
  }

  recordAudioFrame(byteLength) {
    this.audioFramesReceived++;
    this.totalAudioBytes += byteLength;
  }

  recordSegmentLatency({ sequence, audioServerReceivedAt, sttFinalizedAt, translationCompletedAt }) {
    const sttLatencyMs = sttFinalizedAt - audioServerReceivedAt;
    const translationLatencyMs = translationCompletedAt - sttFinalizedAt;
    const totalServerLatencyMs = translationCompletedAt - audioServerReceivedAt;

    const record = {
      sequence,
      sttLatencyMs: Math.max(0, sttLatencyMs),
      translationLatencyMs: Math.max(0, translationLatencyMs),
      totalServerLatencyMs: Math.max(0, totalServerLatencyMs),
      timestamp: Date.now(),
    };

    this.latencies.push(record);
    if (this.latencies.length > 200) {
      this.latencies.shift(); // Keep moving window
    }

    this.translationCount++;
    return record;
  }

  getSummary() {
    const total = this.latencies.length;
    if (total === 0) {
      return {
        sessionId: this.sessionId,
        uptimeMs: Date.now() - this.sessionStartTime,
        audioFramesReceived: this.audioFramesReceived,
        totalAudioBytes: this.totalAudioBytes,
        translationCount: this.translationCount,
        averageSttLatencyMs: 0,
        averageTranslationLatencyMs: 0,
        averageServerLatencyMs: 0,
      };
    }

    const sumStt = this.latencies.reduce((acc, l) => acc + l.sttLatencyMs, 0);
    const sumTr = this.latencies.reduce((acc, l) => acc + l.translationLatencyMs, 0);
    const sumTotal = this.latencies.reduce((acc, l) => acc + l.totalServerLatencyMs, 0);

    return {
      sessionId: this.sessionId,
      uptimeMs: Date.now() - this.sessionStartTime,
      audioFramesReceived: this.audioFramesReceived,
      totalAudioBytes: this.totalAudioBytes,
      translationCount: this.translationCount,
      averageSttLatencyMs: Math.round(sumStt / total),
      averageTranslationLatencyMs: Math.round(sumTr / total),
      averageServerLatencyMs: Math.round(sumTotal / total),
    };
  }
}

module.exports = MetricsCollector;
