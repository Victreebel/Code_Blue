import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from '../../engine/types/core';
import type { TeamMemberRuntime } from '../../engine/types/team';

interface StopwatchWidgetProps {
  clock: number;
  lastEpiAt: number | null;
  lastRhythmCheckAt: number | null;
  team: TeamMemberRuntime[];
}

function useWallClock() {
  const fmt = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const [wallTime, setWallTime] = useState(fmt);
  useEffect(() => {
    const id = setInterval(() => setWallTime(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return wallTime;
}

export default function StopwatchWidget({
  clock,
  lastEpiAt,
  lastRhythmCheckAt,
  team,
}: StopwatchWidgetProps) {
  const [open, setOpen] = useState(true);
  const wallTime = useWallClock();

  const [swRunning, setSwRunning] = useState(false);
  const [swElapsed, setSwElapsed] = useState(0);

  const timekeeper =
    team.find(m => m.assignedRole === 'timekeeper' && m.confirmedRole) ?? null;

  useEffect(() => {
    if (timekeeper && !swRunning && clock > 0) {
      setSwRunning(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!timekeeper, clock > 0]);

  useEffect(() => {
    if (!swRunning) return;
    const id = setInterval(() => setSwElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [swRunning]);

  const sinceEpi    = lastEpiAt         === null ? null : clock - lastEpiAt;
  const sinceRhythm = lastRhythmCheckAt === null ? null : clock - lastRhythmCheckAt;

  const handleStart = () => { if (!swRunning) setSwRunning(true); };
  const handleStop  = () => setSwRunning(false);
  const handleReset = () => { setSwRunning(false); setSwElapsed(0); };

  return (
    <div className="bg-gray-900/90 rounded-lg border border-gray-800 overflow-hidden backdrop-blur-sm text-[11px]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-gray-500 text-[10px] tracking-wider">TIMERS</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-blue-300 text-[10px]">{wallTime}</span>
          <span className="text-gray-600 text-[10px]">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-1.5">

              {/* ── Arrest timer ── */}
              <div>
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="text-gray-400">Arrest timer</span>
                  <span
                    className={`font-mono text-sm ${
                      swRunning
                        ? 'text-green-400'
                        : swElapsed > 0
                        ? 'text-amber-300'
                        : 'text-gray-500'
                    }`}
                  >
                    {formatTime(swElapsed)}
                  </span>
                </div>

                {timekeeper ? (
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    <span>⏱</span>
                    <span>{timekeeper.name} keeping time</span>
                  </div>
                ) : (
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={handleStart}
                      disabled={swRunning}
                      className="flex-1 text-[10px] py-0.5 rounded bg-green-900/50 text-green-400 border border-green-800/60 disabled:opacity-30 hover:bg-green-900/80 transition-colors"
                    >
                      Start
                    </button>
                    <button
                      onClick={handleStop}
                      disabled={!swRunning}
                      className="flex-1 text-[10px] py-0.5 rounded bg-amber-900/50 text-amber-400 border border-amber-800/60 disabled:opacity-30 hover:bg-amber-900/80 transition-colors"
                    >
                      Stop
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 text-[10px] py-0.5 rounded bg-gray-800/80 text-gray-400 border border-gray-700 hover:bg-gray-700 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-800/60" />

              {/* ── Derived intervals ── */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-gray-400">
                  <span>Since last epi</span>
                  <span className="font-mono">
                    {sinceEpi === null ? '—' : formatTime(sinceEpi)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Since rhythm chk</span>
                  <span className="font-mono">
                    {sinceRhythm === null ? '—' : formatTime(sinceRhythm)}
                  </span>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
