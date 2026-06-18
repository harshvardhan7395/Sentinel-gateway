import { createBreaker } from '../src/circuit/breaker';
import { SourceUnavailable } from '../src/errors/types';

const FAST_CONFIG = {
  errorThresholdPercentage: 60,
  volumeThreshold: 5,
  resetTimeout: 200,
  timeout: 500,
};

function makeFailingFn() {
  return jest.fn().mockRejectedValue(new Error('source down'));
}

function makeSucceedingFn(value: Record<string, unknown> = { data: 'ok' }) {
  return jest.fn().mockResolvedValue(value);
}

async function fireN(breaker: ReturnType<typeof createBreaker>, n: number) {
  for (let i = 0; i < n; i++) {
    await breaker.fire('user-1').catch(() => {});
  }
}

describe('Circuit breaker', () => {
  it('should return closed state when no failures have occurred', () => {
    const breaker = createBreaker('digid', makeSucceedingFn(), FAST_CONFIG);
    expect(breaker.getState()).toBe('closed');
  });

  it('should return fetched data when circuit is closed and source is healthy', async () => {
    const fn = makeSucceedingFn({ income: 50000 });
    const breaker = createBreaker('digid', fn, FAST_CONFIG);
    const result = await breaker.fire('user-1');
    expect(result).toEqual({ income: 50000 });
  });

  it('should transition circuit to open when failure rate exceeds threshold over min volume', async () => {
    const breaker = createBreaker('digid', makeFailingFn(), FAST_CONFIG);
    await fireN(breaker, 6);
    expect(breaker.getState()).toBe('open');
  });

  it('should throw SourceUnavailable when circuit is open', async () => {
    const breaker = createBreaker('digid', makeFailingFn(), FAST_CONFIG);
    await fireN(breaker, 6);
    expect(breaker.getState()).toBe('open');

    await expect(breaker.fire('user-1')).rejects.toBeInstanceOf(SourceUnavailable);
  });

  it('should fast-fail without calling source when circuit is open', async () => {
    const fn = makeFailingFn();
    const breaker = createBreaker('digid', fn, FAST_CONFIG);
    await fireN(breaker, 6);
    const callsBefore = fn.mock.calls.length;

    await breaker.fire('user-1').catch(() => {});
    expect(fn.mock.calls.length).toBe(callsBefore);
  });

  it('should transition to half-open after resetTimeout and allow a probe', async () => {
    const breaker = createBreaker('digid', makeFailingFn(), FAST_CONFIG);
    await fireN(breaker, 6);
    expect(breaker.getState()).toBe('open');

    await new Promise((r) => setTimeout(r, 250));
    expect(breaker.getState()).toBe('half-open');
  });

  it('should return to closed when probe succeeds in half-open state', async () => {
    let fail = true;
    const fn = jest.fn().mockImplementation(() =>
      fail ? Promise.reject(new Error('down')) : Promise.resolve({ data: 'ok' }),
    );
    const breaker = createBreaker('digid', fn, FAST_CONFIG);

    await fireN(breaker, 6);
    expect(breaker.getState()).toBe('open');

    await new Promise((r) => setTimeout(r, 250));
    expect(breaker.getState()).toBe('half-open');

    fail = false;
    await breaker.fire('user-1');
    expect(breaker.getState()).toBe('closed');
  });
});
