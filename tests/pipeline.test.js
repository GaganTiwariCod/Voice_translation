process.env.STT_PROVIDER = 'mock';
process.env.TRANSLATION_PROVIDER = 'mock';

const http = require('http');
const { WebSocket } = require('ws');
const app = require('../src/app');
const { setupWebSocketServer } = require('../src/websocket/connection');
const sessionManager = require('../src/sessions/sessionManager');

describe('Full Translation Pipeline (Audio -> STT -> MT -> Subtitles)', () => {
  let server;
  let port;
  let wsUrl;

  beforeAll((done) => {
    server = http.createServer(app);
    setupWebSocketServer(server);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      wsUrl = `ws://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    sessionManager.shutdown();
    server.close(done);
  });

  it('streams audio chunks and receives partial transcripts, final transcript, and translated text with latency metrics', (done) => {
    const ws = new WebSocket(wsUrl);
    let receivedPartial = false;
    let receivedFinalTranscript = false;
    let receivedTranslation = false;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'session.start',
        protocolVersion: 1,
        sourceLanguage: 'en',
        targetLanguage: 'hi',
        audioFormat: {
          encoding: 'pcm_s16le',
          sampleRate: 16000,
          channels: 1,
        },
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'session.ready') {
        // Stream audio chunks continuously (100ms frames = 3200 bytes each)
        // Send 16 frames = 51200 bytes (triggers mock STT partial at 16k and final at 48k)
        for (let i = 0; i < 16; i++) {
          const frame = Buffer.alloc(3200);
          ws.send(frame);
        }
      } else if (msg.type === 'transcript.partial') {
        receivedPartial = true;
        expect(msg.text).toBeTruthy();
      } else if (msg.type === 'transcript.final') {
        receivedFinalTranscript = true;
        expect(msg.text).toContain('central station');
      } else if (msg.type === 'translation.final') {
        receivedTranslation = true;
        expect(msg.sourceText).toContain('central station');
        expect(msg.translatedText).toBeTruthy();
        expect(msg.targetLanguage).toBe('hi');
        expect(msg.latencyMetrics).toBeDefined();
        expect(msg.latencyMetrics.totalServerLatencyMs).toBeGreaterThanOrEqual(0);

        // Verify all 3 stages succeeded
        expect(receivedPartial).toBe(true);
        expect(receivedFinalTranscript).toBe(true);
        expect(receivedTranslation).toBe(true);

        ws.send(JSON.stringify({ type: 'session.stop' }));
      } else if (msg.type === 'session.ended') {
        ws.on('close', () => {
          setTimeout(done, 50);
        });
        ws.close();
      }
    });
  });
});
