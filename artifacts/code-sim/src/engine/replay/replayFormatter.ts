import type { ReplayEvent } from '../types/replay';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatClock(timestamp: number): string {
  const total = Math.max(0, Math.floor(timestamp));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function formatPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (v == null) continue;
    if (typeof v === 'object') {
      parts.push(`${k}=${JSON.stringify(v)}`);
    } else {
      parts.push(`${k}=${String(v)}`);
    }
  }
  return parts.length ? ` (${parts.join(', ')})` : '';
}

export function formatEvent(event: ReplayEvent): string {
  return `[${formatClock(event.timestamp)}] ${event.source}: ${event.eventType}${formatPayload(
    event.payload,
  )}`;
}

export function formatEvents(events: ReplayEvent[]): string[] {
  return events.map(formatEvent);
}

export function formatEventsAsText(events: ReplayEvent[]): string {
  return formatEvents(events).join('\n');
}
