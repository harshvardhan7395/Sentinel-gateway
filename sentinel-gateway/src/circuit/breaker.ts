import CircuitBreaker from 'opossum';
import { UserNotFound, ConsentRevoked, SourceUnavailable } from '../errors/types';

export interface BreakerOptions {
  errorThresholdPercentage?: number;
  volumeThreshold?: number;
  resetTimeout?: number;
  timeout?: number;
}

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface GatewayBreaker<TArgs extends unknown[], TResult> {
  fire(...args: TArgs): Promise<TResult>;
  getState(): BreakerState;
}

const defaults: Required<BreakerOptions> = {
  errorThresholdPercentage: 60,
  volumeThreshold: 5,
  resetTimeout: 10_000,
  timeout: 3_000,
};

function isDomainError(err: unknown): boolean {
  return err instanceof UserNotFound || err instanceof ConsentRevoked;
}

export function createBreaker<TArgs extends unknown[], TResult>(
  source: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options: BreakerOptions = {},
): GatewayBreaker<TArgs, TResult> {
  const config = { ...defaults, ...options };

  const breaker = new CircuitBreaker(fn, {
    errorThresholdPercentage: config.errorThresholdPercentage,
    volumeThreshold: config.volumeThreshold,
    resetTimeout: config.resetTimeout,
    timeout: config.timeout,
    // Domain errors (not-found, consent-revoked) are not infrastructure failures
    // — they should not count toward the failure rate that trips the circuit.
    errorFilter: isDomainError,
  });

  return {
    async fire(...args: TArgs): Promise<TResult> {
      try {
        return await (breaker.fire(...args) as Promise<TResult>);
      } catch (err) {
        // Re-throw domain errors unchanged so the gateway can map them correctly.
        if (isDomainError(err)) throw err;
        // Opossum rejects with code EOPENBREAKER when the circuit is open.
        if (breaker.opened || (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EOPENBREAKER')) {
          throw new SourceUnavailable(source, `${source} circuit is open — failing fast`);
        }
        throw err;
      }
    },
    getState(): BreakerState {
      if (breaker.opened) return 'open';
      if (breaker.halfOpen) return 'half-open';
      return 'closed';
    },
  };
}