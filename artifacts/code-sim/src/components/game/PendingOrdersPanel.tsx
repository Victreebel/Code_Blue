import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PendingOrder } from '../../engine/types/orders';

interface PendingOrdersPanelProps {
  orders: PendingOrder[];
  clock: number;
}

const STATUS_COLORS: Record<string, string> = {
  issued:          'text-gray-400 bg-gray-800/60',
  heard:           'text-blue-300 bg-blue-900/40',
  acknowledged:    'text-amber-200 bg-amber-900/40',
  in_progress:     'text-green-300 bg-green-900/40',
  completed:       'text-green-400 bg-green-900/60',
  delayed:         'text-yellow-300 bg-yellow-900/40',
  wrong_recipient: 'text-orange-300 bg-orange-900/40',
  failed:          'text-red-400 bg-red-900/40',
  missed:          'text-red-500 bg-red-950/60',
};

export default function PendingOrdersPanel({ orders, clock }: PendingOrdersPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-lg overflow-hidden backdrop-blur-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-[10px] text-gray-500 tracking-wider">PENDING ORDERS</span>
        <div className="flex items-center gap-1.5">
          {orders.length > 0 && (
            <span className="text-[9px] bg-amber-900/60 text-amber-300 border border-amber-700/40 rounded px-1 font-bold">
              {orders.length}
            </span>
          )}
          <span className="text-[10px] text-gray-600">{open ? '▲' : '▼'}</span>
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
            <div className="px-2 pb-2">
              {orders.length === 0 ? (
                <div className="text-[11px] text-gray-600 italic">No orders in flight.</div>
              ) : (
                <div className="space-y-1.5">
                  {orders.map(o => {
                    const elapsed = clock - o.issuedAt;
                    return (
                      <motion.div
                        key={o.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/30 border border-gray-800 rounded p-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] text-gray-200 font-bold truncate">{o.label}</div>
                          <span className={`text-[9px] px-1 py-0.5 rounded uppercase font-bold ${STATUS_COLORS[o.status] ?? ''}`}>
                            {o.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5 text-[10px]">
                          <span className="text-gray-500">→ {o.targetRole ?? 'unassigned'}</span>
                          <span className="text-gray-500 font-mono">{elapsed.toFixed(1)}s</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
