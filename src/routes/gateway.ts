import { Router, Request, Response } from 'express';
import { createBreaker, GatewayBreaker } from '../circuit/breaker';
import { digidConnector } from '../connectors/digid';
import { idinConnector } from '../connectors/idin';
import { ConnectorResult } from '../connectors/base';
import { SourceUnavailable, UserNotFound, ConsentRevoked } from '../errors/types';
import { recordEvent } from '../observability/events';

const digidBreaker: GatewayBreaker<[string], ConnectorResult> = createBreaker(
  'digid',
  (userId: string) => digidConnector.fetch(userId),
);

const idinBreaker: GatewayBreaker<[string], ConnectorResult> = createBreaker(
  'idin',
  (userId: string) => idinConnector.fetch(userId),
);

export const breakers = { digid: digidBreaker, idin: idinBreaker };

const router = Router();

router.post('/fetch', async (req: Request, res: Response) => {
  const source = req.query['source'] as string;
  const { userId } = req.body as { userId?: string };

  if (!userId) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'userId is required' });
    return;
  }

  if (source !== 'digid' && source !== 'idin') {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'source must be digid or idin' });
    return;
  }

  const breaker = breakers[source];
  const started = Date.now();
  res.on('finish', () => {
    recordEvent({
      source,
      status: res.statusCode,
      code: res.statusCode >= 400 ? (res.locals['errorCode'] as string | undefined) : undefined,
      latencyMs: Date.now() - started,
      circuitAfter: breaker.getState(),
    });
  });

  try {
    const result = await breaker.fire(userId);
    res.json(result);
  } catch (err) {
    if (err instanceof SourceUnavailable || err instanceof UserNotFound || err instanceof ConsentRevoked) {
      res.locals['errorCode'] = err.code;
    } else {
      res.locals['errorCode'] = 'INTERNAL_ERROR';
    }
    if (err instanceof SourceUnavailable) {
      res.status(503).json({
        code: err.code,
        message: err.message,
        source: err.source,
        timestamp: new Date().toISOString(),
      });
    } else if (err instanceof UserNotFound) {
      res.status(404).json({
        code: err.code,
        message: err.message,
        source: err.source,
        timestamp: new Date().toISOString(),
      });
    } else if (err instanceof ConsentRevoked) {
      res.status(403).json({
        code: err.code,
        message: err.message,
        source: err.source,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      });
    }
  }
});

export default router;
