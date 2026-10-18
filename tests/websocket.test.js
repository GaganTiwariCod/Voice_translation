const http = require('http');
const { WebSocket } = require('ws');
const app = require('../src/app');
const { setupWebSocketServer } = require('../src/websocket/connection');
const sessionManager = require('../src/sessions/sessionManager');

describe('WebSocket Transport Protocol (Phase 2)', () => {
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

  it('rejects binary audio before session.start', (done) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => {
      const dummyAudio = Buffer.alloc(320); // 10ms of 16kHz 16-bit mono
      ws.send(dummyAudio);
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('error');
      expect(msg.code).toBe('SESSION_NOT_INITIALIZED');
      ws.close();
      done();
    });
  });

  it('rejects unsupported language pair', (done) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'session.start',
        protocolVersion: 1,
        sourceLanguage: 'klingon',
        targetLanguage: 'elven',
        audioFormat: {
          encoding: 'pcm_s16le',
          sampleRate: 16000,
          channels: 1,
        },
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg.type).toBe('error');
      expect(msg.code).toBe('UNSUPPORTED_LANGUAGE');
      ws.close();
      done();
    });
  });

  it('successfully starts session, accepts binary audio frames, and stops session cleanly', (done) => {
    const ws = new WebSocket(wsUrl);
    let sessionId = null;

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
        expect(msg.sessionId).toBeDefined();
        expect(msg.protocolVersion).toBe(1);
        sessionId = msg.sessionId;

        // Verify session exists in sessionManager
        const session = sessionManager.getSession(sessionId);
        expect(session).not.toBeNull();
        expect(session.sourceLanguage).toBe('en');
        expect(session.targetLanguage).toBe('hi');

        // Send 5 binary audio frames (simulating streaming audio)
        for (let i = 0; i < 5; i++) {
          const frame = Buffer.alloc(640); // 20ms of audio
          ws.send(frame);
        }

        // Wait a short tick and send session.stop
        setTimeout(() => {
          expect(session.audioQueue.size()).toBe(5);
          expect(session.metrics.audioFramesReceived).toBe(5);
          ws.send(JSON.stringify({ type: 'session.stop' }));
        }, 50);
      } else if (msg.type === 'session.ended') {
        expect(msg.sessionId).toBe(sessionId);
        expect(sessionManager.getSession(sessionId)).toBeNull();
        ws.close();
        done();
      }
    });
  });

  it('cleans up session when client socket disconnects abruptly', (done) => {
    const ws = new WebSocket(wsUrl);
    let sessionId = null;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'session.start',
        protocolVersion: 1,
        sourceLanguage: 'en',
        targetLanguage: 'es',
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
        sessionId = msg.sessionId;
        expect(sessionManager.getSession(sessionId)).not.toBeNull();
        // Abruptly terminate socket
        ws.terminate();

        // Check that session is destroyed
        setTimeout(() => {
          expect(sessionManager.getSession(sessionId)).toBeNull();
          done();
        }, 100);
      }
    });
  });
});
