import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from '../../engine/types/core';

interface StopwatchWidgetProps {
  clock: number;
  lastEpiAt: number | null;
  lastRhythmCheckAt: number | null;
}

export default function StopwatchWidget({ clock, lastEpiAt, lastRhythmCheckAt }: StopwatchWidgetProps) {
  const [open, setOpen] = useState(true);
  const sinceEpi    = lastEpiAt          === null ? null : clock - lastEpiAt;
  const sinceRhythm = lastRhythmCheckAt  === null ? null : clock - lastRhythmCheckAt;

  return (
    <div className="bg-gray-900/90 rounded-lg border border-gray-800 overflow-hidden backdrop-blur-sm text-[11px]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-gray-500 text-[10px] tracking-wider">TIMERS</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-amber-300 text-[10px]">{formatTime(clock)}</span>
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
            <div className="px-2 pb-2 space-y-0.5">
              <div className="flex justify-between text-gray-400">
                <span>Since last epi</span>
                <span className="font-mono">{sinceEpi    === null ? '—' : formatTime(sinceEpi)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Since rhythm chk</span>
                <span className="font-mono">{sinceRhythm === null ? '—' : formatTime(sinceRhythm)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
