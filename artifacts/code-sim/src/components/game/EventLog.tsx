import { type ActionLogEntry } from '../../engine/types';
import { formatTime } from '../../engine/gameReducer';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EventLogProps {
  entries: ActionLogEntry[];
}

const CATEGORY_COLORS: Record<string, string> = {
  command: 'text-blue-400',
  event: 'text-yellow-400',
  team: 'text-green-400',
  system: 'text-gray-300',
  complication: 'text-red-400',
};

const CATEGORY_ICONS: Record<string, string> = {
  command: '▸',
  event: '◆',
  team: '●',
  system: '■',
  complication: '⚠',
};

export default function EventLog({ entries }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  const recent = entries.slice(-30);

  return (
    <div className="bg-gray-900/90 rounded-lg border border-gray-700 p-3 h-full flex flex-col">
      <h3 className="text-xs font-bold text-gray-300 tracking-wider mb-2">EVENT LOG</h3>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-0.5 font-mono text-[11px] pr-1 min-h-0">
        <AnimatePresence initial={false}>
          {recent.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-2 py-0.5"
            >
              <span className="text-gray-600 shrink-0 w-10">{formatTime(entry.time)}</span>
              <span className={`shrink-0 ${CATEGORY_COLORS[entry.category]}`}>
                {CATEGORY_ICONS[entry.category]}
              </span>
              <span className={CATEGORY_COLORS[entry.category]}>
                {entry.action}
                {entry.details && <span className="text-gray-500 ml-1">— {entry.details}</span>}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
