import type { TeamMemberRuntime } from '../../engine/types/team';
import { motion } from 'framer-motion';

interface LiveRoomCanvasProps {
  team: TeamMemberRuntime[];
  cprActive: boolean;
}

const POSITIONS: Record<string, { x: number; y: number; label: string }> = {
  compressor: { x: 50, y: 32, label: 'CPR' },
  airway: { x: 50, y: 14, label: 'Airway' },
  monitor_defib: { x: 78, y: 32, label: 'Defib' },
  iv_access: { x: 22, y: 50, label: 'IV' },
  medication: { x: 78, y: 50, label: 'Meds' },
  recorder: { x: 22, y: 14, label: 'Rec' },
  timekeeper: { x: 22, y: 76, label: 'Time' },
  leader: { x: 50, y: 76, label: 'LEAD' },
  none: { x: 92, y: 80, label: '' },
};

export default function LiveRoomCanvas({ team, cprActive }: LiveRoomCanvasProps) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-2">
      <div className="text-[10px] text-gray-500 tracking-wider mb-1">ROOM</div>
      <div className="relative w-full aspect-square bg-gray-900/80 rounded border border-gray-800 overflow-hidden">
        <div className="absolute left-[30%] top-[30%] w-[40%] h-[20%] bg-blue-950/40 border border-blue-900/50 rounded">
          <motion.div
            className="absolute inset-0 flex items-center justify-center text-[10px] text-blue-300"
            animate={cprActive ? { opacity: [1, 0.4, 1] } : {}}
            transition={{ duration: 0.6, repeat: Infinity }}
          >
            {cprActive ? 'CPR' : 'PATIENT'}
          </motion.div>
        </div>
        {team.map(m => {
          const pos = POSITIONS[m.assignedRole] ?? POSITIONS.none;
          return (
            <motion.div
              key={m.id}
              className="absolute"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-bold border-2 ${
                  m.isLeader
                    ? 'bg-amber-700 border-amber-300 text-amber-50'
                    : m.confirmedRole
                      ? 'bg-green-900 border-green-500 text-green-100'
                      : 'bg-gray-800 border-gray-600 text-gray-300'
                }`}
              >
                {m.name.split(' ')[0].slice(0, 3)}
              </div>
              <div className="text-[8px] text-gray-500 text-center mt-0.5">{pos.label}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
