// In-memory ring buffer of recent gateway requests, used by the live dashboard.
// Deliberately tiny and process-local: this is a demo observability surface,
// not a replacement for real metrics (Prometheus, CloudWatch).

export interface RequestEvent {
  id: number;
  at: string;
  source: string;
  status: number;
  code?: string;
  latencyMs: number;
  circuitAfter: string;
}

const MAX_EVENTS = 50;
const events: RequestEvent[] = [];
let nextId = 1;

export function recordEvent(event: Omit<RequestEvent, 'id' | 'at'>): void {
  events.push({ id: nextId++, at: new Date().toISOString(), ...event });
  if (events.length > MAX_EVENTS) events.shift();
}

export function recentEvents(): RequestEvent[] {
  return [...events].reverse();
}
