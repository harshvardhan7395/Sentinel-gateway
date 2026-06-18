import { Router, Request, Response } from 'express';
import { breakers } from './gateway';

const router = Router();

router.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

router.get('/ready', (_req: Request, res: Response) => {
  const states = Object.values(breakers).map((b) => b.getState());
  const allOpen = states.every((s) => s === 'open');
  if (allOpen) {
    res.status(503).json({ status: 'degraded', message: 'all source connectors unavailable' });
  } else {
    res.json({ status: 'ok' });
  }
});

router.get('/health', (_req: Request, res: Response) => {

  res.json({
    digid: breakers.digid.getState(),
    idin: breakers.idin.getState(),
  });
});

export default router;