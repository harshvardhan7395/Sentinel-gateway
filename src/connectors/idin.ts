import { Connector, ConnectorResult, ConnectorState, withRetry } from './base';
import { UserNotFound, ConsentRevoked } from '../errors/types';

class IdinConnector implements Connector {
  private state: ConnectorState = 'healthy';

  setState(state: ConnectorState): void {
    this.state = state;
  }

  getState(): ConnectorState {
    return this.state;
  }

  async fetch(userId: string): Promise<ConnectorResult> {
    return withRetry(
      () => this.callSource(userId),
      2,
      (err) => err instanceof Error && err.message === 'TRANSIENT',
    );
  }

  private async callSource(userId: string): Promise<ConnectorResult> {
    if (this.state === 'down') {
      throw new Error('TRANSIENT');
    }

    if (this.state === 'flaky' && Math.random() < 0.7) {
      throw new Error('TRANSIENT');
    }

    if (userId === 'unknown') {
      throw new UserNotFound('idin', userId);
    }

    if (userId === 'revoked') {
      throw new ConsentRevoked('idin', userId);
    }

    return {
      source: 'idin',
      userId,
      data: {
        bankVerified: true,
        bankName: 'ING',
        accountHolder: 'Jan de Vries',
        ibanVerified: true,
      },
      fetchedAt: new Date().toISOString(),
    };
  }
}

export const idinConnector = new IdinConnector();
