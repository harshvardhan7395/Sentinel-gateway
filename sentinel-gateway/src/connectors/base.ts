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
