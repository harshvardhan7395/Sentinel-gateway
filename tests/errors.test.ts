import { SourceUnavailable, UserNotFound, ConsentRevoked } from '../src/errors/types';

describe('GatewayError types', () => {
  it('should have correct code and httpStatus for SourceUnavailable', () => {
    const err = new SourceUnavailable('digid', 'circuit open');
    expect(err.code).toBe('SOURCE_UNAVAILABLE');
    expect(err.httpStatus).toBe(503);
    expect(err.source).toBe('digid');
    expect(err instanceof Error).toBe(true);
  });

  it('should have correct code and httpStatus for UserNotFound', () => {
    const err = new UserNotFound('digid', 'user-123');
    expect(err.code).toBe('USER_NOT_FOUND');
    expect(err.httpStatus).toBe(404);
    expect(err.userId).toBe('user-123');
  });

  it('should have correct code and httpStatus for ConsentRevoked', () => {
    const err = new ConsentRevoked('idin', 'user-456');
    expect(err.code).toBe('CONSENT_REVOKED');
    expect(err.httpStatus).toBe(403);
    expect(err.userId).toBe('user-456');
  });
});