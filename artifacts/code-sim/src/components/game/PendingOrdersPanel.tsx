import { type PendingOrder, type OrderStatus } from '../../engine/types';
import { formatTime } from '../../engine/gameReducer';
import { motion, AnimatePresence } from 'framer-motion';

interface PendingOrdersPanelProps {
  orders: PendingOrder[];
  clock: number;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  issued: { label: 'ORDERED', color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  heard: { label: 'HEARD', color: 'text-amber-300', bg: 'bg-amber-900/20' },
  acknowledged: { label: 'ACK', color: 'text-blue-400', bg: 'bg-blue-900/30' },
  in_progress: { label: 'IN PROGRESS', color: 'text-cyan-400', bg: 'bg-cyan-900/30' },
  completed: { label: 'DONE', color: 'text-green-400', bg: 'bg-green-900/30' },
  failed: { label: 'FAILED', color: 'text-red-400', bg: 'bg-red-900/30' },
  missed: { label: 'MISSED', color: 'text-red-500', bg: 'bg-red-900/40' },
};

function StatusDots({ status }: { status: OrderStatus }) {
  const stages: OrderStatus[] = ['issued', 'heard', 'acknowledged', 'in_progress', 'completed'];
  const currentIndex = stages.indexOf(status);
  const isFailed = status === 'failed' || status === 'missed';

  return (
    <div className="flex items-center gap-0.5">
      {stages.map((stage, i) => {
        const isActive = i <= currentIndex && !isFailed;
        const isCurrent = i === currentIndex && !isFailed;
        return (
          <div key={stage} className="flex items-center">
            <motion.div
              className={`w-1.5 h-1.5 rounded-full ${
                isFailed ? 'bg-red-500' :
                isActive ? 'bg-green-400' : 'bg-gray-700'
              }`}
              animate={isCurrent ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
            {i < stages.length - 1 && (
              <div className={`w-2 h-px ${isActive && i < currentIndex ? 'bg-green-600' : 'bg-gray-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PendingOrdersPanel({ orders, clock }: PendingOrdersPanelProps) {
  const activeOrders = orders.filter(o => o.status !== 'completed' || clock - o.issuedAt < 10);

  if (activeOrders.length === 0) {
    return (
      <div className="bg-gray-900/90 rounded-lg border border-gray-700 p-3">
        <h3 className="text-xs font-bold text-gray-500 tracking-wider">PENDING ORDERS</h3>
        <p className="text-[10px] text-gray-600 mt-2">No active orders</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/90 rounded-lg border border-gray-700 p-3">
      <h3 className="text-xs font-bold text-gray-300 tracking-wider mb-2">
        PENDING ORDERS ({activeOrders.filter(o => !['completed', 'failed', 'missed'].includes(o.status)).length})
      </h3>
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {activeOrders.map(order => {
            const cfg = STATUS_CONFIG[order.status];
            const elapsed = Math.floor(clock - order.issuedAt);
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={`flex items-center justify-between px-2 py-1 rounded text-[10px] ${cfg.bg} border border-gray-800`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-gray-500 shrink-0">{formatTime(order.issuedAt)}</span>
                  <span className="text-gray-300 truncate">{order.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusDots status={order.status} />
                  <span className={`font-bold ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-gray-600">{elapsed}s</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
