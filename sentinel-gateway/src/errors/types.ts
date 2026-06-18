export class SourceUnavailable extends Error {
  readonly code = 'SOURCE_UNAVAILABLE';
  readonly httpStatus = 503;

  constructor(
    public readonly source: string,
    message?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message ?? `${source} is currently unavailable`);
    this.name = 'SourceUnavailable';
  }
}

export class UserNotFound extends Error {
  readonly code = 'USER_NOT_FOUND';
  readonly httpStatus = 404;

  constructor(
    public readonly source: string,
    public readonly userId: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(`User ${userId} not found in ${source}`);
    this.name = 'UserNotFound';
  }
}

export class ConsentRevoked extends Error {
  readonly code = 'CONSENT_REVOKED';
  readonly httpStatus = 403;

  constructor(
    public readonly source: string,
    public readonly userId: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(`Consent revoked for user ${userId} in ${source}`);
    this.name = 'ConsentRevoked';
  }
}

export type GatewayError = SourceUnavailable | UserNotFound | ConsentRevoked;
