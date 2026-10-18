const request = require('supertest');
const app = require('../src/app');

describe('HTTP Health Check Endpoint', () => {
  it('GET /health returns 200 with service status and active sessions', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'live-translator-server');
    expect(res.body).toHaveProperty('activeSessions');
    expect(res.body).toHaveProperty('uptimeSeconds');
  });

  it('GET /api/health also returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
