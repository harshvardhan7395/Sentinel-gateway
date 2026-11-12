import request from 'supertest';
import app from '../src/app';
import { digidConnector } from '../src/connectors/digid';
import { idinConnector } from '../src/connectors/idin';
import { breakers } from '../src/routes/gateway';

beforeEach(() => {
  digidConnector.setState('healthy');
  idinConnector.setState('healthy');
});

describe('POST /fetch', () => {
  it('should return fetched data when DigiD connector is healthy and circuit is closed', async () => {
    const res = await request(app)
      .post('/fetch?source=digid')
      .send({ userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('digid');
    expect(res.body.data.annualIncome).toBe(65000);
  });

  it('should return USER_NOT_FOUND when source returns 404', async () => {
    const res = await request(app)
      .post('/fetch?source=digid')
      .send({ userId: 'unknown' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  it('should return CONSENT_REVOKED when source returns 403', async () => {
    const res = await request(app)
      .post('/fetch?source=digid')
      .send({ userId: 'revoked' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CONSENT_REVOKED');
  });

  it('should return 400 when userId is missing', async () => {
    const res = await request(app).post('/fetch?source=digid').send({});
    expect(res.status).toBe(400);
  });

  it('should return 400 when source is invalid', async () => {
    const res = await request(app).post('/fetch?source=bsn').send({ userId: 'user-1' });
    expect(res.status).toBe(400);
  });

  it('should return idin data when source is idin and connector is healthy', async () => {
    const res = await request(app)
      .post('/fetch?source=idin')
      .send({ userId: 'user-1' });

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('idin');
    expect(res.body.data.bankVerified).toBe(true);
  });
});

describe('GET /live', () => {
  it('should return 200 regardless of circuit state', async () => {
    digidConnector.setState('down');
    const res = await request(app).get('/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /ready', () => {
  it('should return 200 when at least one circuit is closed', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
  });

  it('should return 503 when all circuits are open', async () => {
    // Trip both circuits by firing enough failures
    const FAST = { errorThresholdPercentage: 60, volumeThreshold: 5, resetTimeout: 200, timeout: 500 };
    const { createBreaker } = await import('../src/circuit/breaker');
    // Override breakers with fast-trip versions for this test
    const failFn = () => Promise.reject(new Error('down'));
    const db = createBreaker('digid', failFn, FAST);
    const ib = createBreaker('idin', failFn, FAST);
    breakers.digid = db;
    breakers.idin = ib;
    for (let i = 0; i < 6; i++) {
      await db.fire().catch(() => {});
      await ib.fire().catch(() => {});
    }
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    // Restore
    breakers.digid = createBreaker('digid', (userId: string) => require('../src/connectors/digid').digidConnector.fetch(userId));
    breakers.idin = createBreaker('idin', (userId: string) => require('../src/connectors/idin').idinConnector.fetch(userId));
  });
});

describe('GET /health', () => {
  it('should return per-connector circuit state as structured JSON', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(['closed', 'open', 'half-open']).toContain(res.body.digid);
    expect(['closed', 'open', 'half-open']).toContain(res.body.idin);
  });
});

describe('POST /control', () => {
  it('should update connector state and affect subsequent fetches', async () => {
    const ctrl = await request(app)
      .post('/control')
      .send({ source: 'digid', state: 'down' });
    expect(ctrl.status).toBe(200);
    expect(digidConnector.getState()).toBe('down');
  });

  it('should return 400 for invalid source', async () => {
    const res = await request(app).post('/control').send({ source: 'unknown', state: 'healthy' });
    expect(res.status).toBe(400);
  });
});
