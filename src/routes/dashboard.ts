import path from 'path';
import { Router, Request, Response } from 'express';
import { breakers } from './gateway';
import { digidConnector } from '../connectors/digid';
import { idinConnector } from '../connectors/idin';
import { recentEvents } from '../observability/events';

const router = Router();

// Resolves from both src/routes (ts-node) and dist/routes (compiled).
const DASHBOARD_HTML = path.join(__dirname, '..', '..', 'public', 'dashboard.html');

router.get('/dashboard', (_req: Request, res: Response) => {
  res.sendFile(DASHBOARD_HTML);
});

router.get('/dashboard/state', (_req: Request, res: Response) => {
  const circuits = {
    digid: breakers.digid.getState(),
    idin: breakers.idin.getState(),
  };
  res.json({
    circuits,
    upstream: {
      digid: digidConnector.getState(),
      idin: idinConnector.getState(),
    },
    ready: !Object.values(circuits).every((s) => s === 'open'),
    events: recentEvents(),
  });
});

export default router;
