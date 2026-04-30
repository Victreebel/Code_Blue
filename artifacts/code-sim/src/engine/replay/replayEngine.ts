import type { ReplayEvent, ReplaySource, ReplayState } from '../types/replay';

export function createReplayState(): ReplayState {
  return { events: [] };
}

export function append(
  state: ReplayState,
  timestamp: number,
  source: ReplaySource,
  eventType: string,
  payload: Record<string, unknown> = {},
): ReplayState {
  const event: ReplayEvent = { timestamp, source, eventType, payload };
  return { events: [...state.events, event] };
}

export function appendMany(state: ReplayState, events: ReplayEvent[]): ReplayState {
  if (events.length === 0) return state;
  return { events: [...state.events, ...events] };
}

export function findEvents(state: ReplayState, predicate: (e: ReplayEvent) => boolean): ReplayEvent[] {
  return state.events.filter(predicate);
}

export function countEvents(state: ReplayState, eventType: string): number {
  let n = 0;
  for (const e of state.events) if (e.eventType === eventType) n++;
  return n;
}

export function firstEvent(state: ReplayState, eventType: string): ReplayEvent | null {
  for (const e of state.events) if (e.eventType === eventType) return e;
  return null;
}

export function lastEvent(state: ReplayState, eventType: string): ReplayEvent | null {
  for (let i = state.events.length - 1; i >= 0; i--) {
    if (state.events[i].eventType === eventType) return state.events[i];
  }
  return null;
}
