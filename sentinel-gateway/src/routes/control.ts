import { Router, Request, Response } from 'express';
import { digidConnector } from '../connectors/digid';
import { idinConnector } from '../connectors/idin';
import { ConnectorState } from '../connectors/base';

const connectors = { digid: digidConnector, idin: idinConnector };
const validStates: ConnectorState[] = ['healthy', 'flaky', 'down'];

const router = Router();

router.post('/control', (req: Request, res: Response) => {
  const { source, state } = req.body as { source?: string; state?: string };

  if (source !== 'digid' && source !== 'idin') {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'source must be digid or idin' });
    return;
  }

  if (!validStates.includes(state as ConnectorState)) {
    res.status(400).json({
      code: 'INVALID_REQUEST',
      message: `state must be one of: ${validStates.join(', ')}`,
    });
    return;
  }

  connectors[source].setState(state as ConnectorState);
  res.json({ source, state });
});

export default router;
