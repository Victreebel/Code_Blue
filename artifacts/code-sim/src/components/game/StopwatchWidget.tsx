import { formatTime } from '../../engine/types/core';

interface StopwatchWidgetProps {
  clock: number;
  lastEpiAt: number | null;
  lastRhythmCheckAt: number | null;
}

export default function StopwatchWidget({ clock, lastEpiAt, lastRhythmCheckAt }: StopwatchWidgetProps) {
  const sinceEpi = lastEpiAt === null ? null : clock - lastEpiAt;
  const sinceRhythm = lastRhythmCheckAt === null ? null : clock - lastRhythmCheckAt;

  return (
    <div className="bg-gray-900/90 rounded-lg border border-gray-800 p-2 text-[11px]">
      <div className="text-gray-500 text-[10px] tracking-wider mb-1">TIMERS</div>
      <div className="flex justify-between text-gray-300">
        <span>Code time</span>
        <span className="font-mono text-amber-300">{formatTime(clock)}</span>
      </div>
      <div className="flex justify-between text-gray-400 mt-0.5">
        <span>Since last epi</span>
        <span className="font-mono">{sinceEpi === null ? '—' : formatTime(sinceEpi)}</span>
      </div>
      <div className="flex justify-between text-gray-400 mt-0.5">
        <span>Since rhythm chk</span>
        <span className="font-mono">{sinceRhythm === null ? '—' : formatTime(sinceRhythm)}</span>
      </div>
    </div>
  );
}
