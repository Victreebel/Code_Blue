import type { ReplayEvent } from '../../engine/types/replay';
import type { TeamMemberRuntime } from '../../engine/types/team';
import { formatTime } from '../../engine/types/core';

interface ReplayTimelineProps {
  events: ReplayEvent[];
  team: TeamMemberRuntime[];
}

const SHOW_EVENTS = new Set([
  'scenario.started',
  'scenario.live',
  'scenario.chaos.fired',
  'scenario.ended',
  'rhythm.transition',
  'rhythm.rosc',
  'pendingOrder.issued',
  'pendingOrder.completed',
  'pendingOrder.failed',
  'pendingOrder.missed',
  'shock.delivered',
  'team.role.assigned',
  'team.role.confirmed',
  'team.compressor.fatigued',
  'user.declare_rosc',
  'user.call_time_of_death',
  'user.closed_loop_request',
]);

export default function ReplayTimeline({ events, team }: ReplayTimelineProps) {
  const filtered = events.filter(e => SHOW_EVENTS.has(e.eventType));
  const memberName = (id: unknown): string => {
    if (typeof id !== 'string') return '';
    return team.find(m => m.id === id)?.name ?? id;
  };
  return (
    <div className="bg-gray-900/70 rounded-lg border border-gray-800 p-3 max-h-96 overflow-y-auto">
      <div className="text-[10px] text-gray-500 tracking-wider mb-2">REPLAY TIMELINE ({filtered.length} events)</div>
      <div className="space-y-1 font-mono text-[11px]">
        {filtered.map((e, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-gray-600 shrink-0">{formatTime(e.timestamp)}</span>
            <span className="text-amber-400 shrink-0">{e.source}</span>
            <span className="text-gray-300 truncate">
              {e.eventType}{' '}
              <span className="text-gray-500">
                {Object.entries(e.payload)
                  .filter(([k]) => k !== 'plannedTerminalAt' && k !== 'plannedFailureSubtype')
                  .slice(0, 4)
                  .map(([k, v]) => {
                    if (k === 'memberId' || k === 'targetMemberId') return `${k}=${memberName(v)}`;
                    return `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;
                  })
                  .join(' ')}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
