export type ConnectorState = 'healthy' | 'flaky' | 'down';

export interface ConnectorResult {
  source: string;
  userId: string;
  data: Record<string, unknown>;
  fetchedAt: string;
}

export interface Connector {
  fetch(userId: string): Promise<ConnectorResult>;
  setState(state: ConnectorState): void;
  getState(): ConnectorState;
}

// Simulated network latency for the mock upstreams, so a fast-fail is visibly
// faster than a real call. Override with UPSTREAM_LATENCY_MS; 0 under Jest.
const BASE_LATENCY_MS = Number(
  process.env['UPSTREAM_LATENCY_MS'] ?? (process.env['NODE_ENV'] === 'test' ? 0 : 120),
);

export async function simulateNetwork(): Promise<void> {
  if (BASE_LATENCY_MS <= 0) return;
  await new Promise((r) => setTimeout(r, jitter(BASE_LATENCY_MS)));
}

function jitter(base: number): number {
  return base + Math.random() * base * 0.3;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  isRetryable: (err: unknown) => boolean,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === maxRetries) throw err;
      const delay = jitter(100 * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
