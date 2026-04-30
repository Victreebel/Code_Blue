import { useEffect, useRef } from 'react';
import type { ReplayEvent } from '../../engine/types/replay';
import type { TeamMemberRuntime } from '../../engine/types/team';
import { formatTime } from '../../engine/types/core';

interface EventLogProps {
  events: ReplayEvent[];
  team: TeamMemberRuntime[];
}

interface RenderedLine {
  ts: number;
  text: string;
  speaker: string | null;
  color: string;
}

function renderLine(e: ReplayEvent, team: TeamMemberRuntime[]): RenderedLine | null {
  const memberName = (id: unknown): string => {
    if (typeof id !== 'string') return 'someone';
    const m = team.find(x => x.id === id);
    return m ? m.name : id;
  };
  switch (e.eventType) {
    case 'scenario.started':
      return { ts: e.timestamp, text: `Code started — initial rhythm ${e.payload.initialRhythm}`, speaker: 'SYSTEM', color: 'text-amber-300' };
    case 'scenario.live':
      return { ts: e.timestamp, text: 'Live — clock running.', speaker: 'SYSTEM', color: 'text-amber-300' };
    case 'scenario.chaos.fired':
      return { ts: e.timestamp, text: `CHAOS: ${e.payload.chaosType}`, speaker: 'SYSTEM', color: 'text-red-400' };
    case 'scenario.ended':
      return { ts: e.timestamp, text: `Scenario ended (${e.payload.outcome})`, speaker: 'SYSTEM', color: 'text-amber-300' };
    case 'rhythm.transition':
      return { ts: e.timestamp, text: `Rhythm: ${e.payload.from} → ${e.payload.to}`, speaker: 'MONITOR', color: 'text-blue-300' };
    case 'rhythm.rosc':
      return { ts: e.timestamp, text: `ROSC achieved — ${e.payload.rhythm}`, speaker: 'MONITOR', color: 'text-green-300' };
    case 'rhythm.shock.no_change':
      return { ts: e.timestamp, text: `Shock: rhythm unchanged (${e.payload.rhythm}).`, speaker: 'MONITOR', color: 'text-blue-300' };
    case 'pendingOrder.issued':
      return { ts: e.timestamp, text: `Order: ${e.payload.label} → ${memberName(e.payload.targetMemberId) || e.payload.targetRole || 'team'}`, speaker: 'YOU', color: 'text-gray-200' };
    case 'pendingOrder.heard':
      return null;
    case 'pendingOrder.acknowledged':
      return null;
    case 'pendingOrder.in_progress':
      return null;
    case 'pendingOrder.completed':
      return { ts: e.timestamp, text: `${e.payload.label} — done`, speaker: memberName(e.payload.targetMemberId), color: 'text-green-300' };
    case 'pendingOrder.failed':
      return { ts: e.timestamp, text: `${e.payload.label} — failed (${e.payload.failureSubtype || 'unknown'})`, speaker: memberName(e.payload.targetMemberId), color: 'text-red-400' };
    case 'pendingOrder.missed':
      return { ts: e.timestamp, text: `${e.payload.label} — never heard`, speaker: 'SYSTEM', color: 'text-red-500' };
    case 'shock.delivered':
      return { ts: e.timestamp, text: `Shock #${e.payload.shockNumber} delivered at ${e.payload.joules}J`, speaker: 'MONITOR', color: 'text-amber-300' };
    case 'team.role.assigned':
      return { ts: e.timestamp, text: `${memberName(e.payload.memberId)} → ${e.payload.newRole}`, speaker: 'YOU', color: 'text-gray-300' };
    case 'team.role.confirmed':
      return { ts: e.timestamp, text: `${memberName(e.payload.memberId)} confirms: ${e.payload.role}`, speaker: 'TEAM', color: 'text-green-300' };
    case 'team.spontaneous_speech':
      return { ts: e.timestamp, text: `"${e.payload.text}"`, speaker: memberName(e.payload.memberId), color: 'text-gray-300' };
    case 'team.compressor.fatigued':
      return { ts: e.timestamp, text: `${memberName(e.payload.memberId)} is fatigued — needs to be swapped`, speaker: 'SYSTEM', color: 'text-amber-300' };
    case 'user.declare_rosc':
      return { ts: e.timestamp, text: 'ROSC declared.', speaker: 'YOU', color: 'text-green-400' };
    case 'user.call_time_of_death':
      return { ts: e.timestamp, text: 'Time of death called.', speaker: 'YOU', color: 'text-red-400' };
    case 'user.closed_loop_request':
      return { ts: e.timestamp, text: 'Closed-loop confirmation requested.', speaker: 'YOU', color: 'text-blue-300' };
    default:
      return null;
  }
}

export default function EventLog({ events, team }: EventLogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lines = events
    .map(e => renderLine(e, team))
    .filter((x): x is RenderedLine => x !== null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);

  return (
    <div className="h-full bg-gray-900/70 border border-gray-800 rounded-lg p-2 flex flex-col min-h-0">
      <div className="text-[10px] text-gray-500 tracking-wider mb-2">EVENT LOG</div>
      <div ref={ref} className="flex-1 overflow-y-auto space-y-0.5 font-mono">
        {lines.map((l, i) => (
          <div key={i} className="text-[11px] flex gap-2">
            <span className="text-gray-600 shrink-0">{formatTime(l.ts)}</span>
            {l.speaker && <span className="text-amber-400 shrink-0">{l.speaker}:</span>}
            <span className={l.color}>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
