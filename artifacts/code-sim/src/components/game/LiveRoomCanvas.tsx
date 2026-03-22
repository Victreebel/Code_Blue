import { type TeamMember, type PatientState, TEAM_ROLE_LABELS } from '../../engine/types';
import { motion } from 'framer-motion';

interface LiveRoomCanvasProps {
  team: TeamMember[];
  patient: PatientState;
  clock: number;
  roomCapacity: number;
  chaosLevel: number;
}

const ROLE_POSITIONS: Record<string, { x: number; y: number }> = {
  compressor: { x: 50, y: 25 },
  airway: { x: 50, y: 75 },
  monitor_defib: { x: 85, y: 50 },
  iv_access: { x: 15, y: 35 },
  recorder: { x: 85, y: 20 },
  medication: { x: 15, y: 65 },
};

const STAFF_COLORS: Record<string, string> = {
  attending: '#f59e0b',
  resident: '#3b82f6',
  nurse: '#10b981',
  rt: '#8b5cf6',
  tech: '#6b7280',
  pharmacist: '#ec4899',
  student: '#94a3b8',
};

function getStaffPosition(member: TeamMember, index: number, totalUnassigned: number) {
  if (member.assignedRole !== 'none' && ROLE_POSITIONS[member.assignedRole]) {
    return ROLE_POSITIONS[member.assignedRole];
  }
  const angle = (index / Math.max(totalUnassigned, 1)) * Math.PI * 2 - Math.PI / 2;
  const radius = 42;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius,
  };
}

function StaffAvatar({ member, x, y }: { member: TeamMember; x: number; y: number }) {
  const color = STAFF_COLORS[member.staffType] || '#6b7280';
  const isCompressor = member.assignedRole === 'compressor';
  const hasSpeech = member.speechBubble !== null;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      <motion.circle
        cx={`${x}%`}
        cy={`${y}%`}
        r="14"
        fill={color}
        fillOpacity={0.3}
        stroke={color}
        strokeWidth={member.confirmedRole ? 2 : 1}
        animate={isCompressor ? { cy: [`${y}%`, `${y - 1.5}%`, `${y}%`] } : {}}
        transition={isCompressor ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : {}}
      />
      <text
        x={`${x}%`}
        y={`${y}%`}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="7"
        fontWeight="bold"
      >
        {member.name.split(' ')[0].slice(0, 4)}
      </text>
      <text
        x={`${x}%`}
        y={`${y + 6}%`}
        textAnchor="middle"
        fill={color}
        fontSize="5"
        opacity={0.8}
      >
        {member.assignedRole !== 'none' ? TEAM_ROLE_LABELS[member.assignedRole] : member.staffType.toUpperCase()}
      </text>

      {hasSpeech && (
        <motion.g
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <rect
            x={`${x - 12}%`}
            y={`${y - 14}%`}
            width="24%"
            height="7%"
            rx="4"
            fill="rgba(0,0,0,0.85)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.5"
          />
          <text
            x={`${x}%`}
            y={`${y - 10}%`}
            textAnchor="middle"
            fill="white"
            fontSize="4.5"
          >
            {(member.speechBubble ?? '').slice(0, 30)}
          </text>
        </motion.g>
      )}
    </motion.g>
  );
}

export default function LiveRoomCanvas({ team, patient, clock, roomCapacity, chaosLevel }: LiveRoomCanvasProps) {
  const inRoom = team.filter(m => m.inRoom);
  const assigned = inRoom.filter(m => m.assignedRole !== 'none');
  const unassigned = inRoom.filter(m => m.assignedRole === 'none');
  const isOvercrowded = inRoom.length > roomCapacity;

  const chaosColor = chaosLevel > 60 ? '#ef4444' : chaosLevel > 30 ? '#f59e0b' : '#22c55e';

  return (
    <div className="bg-gray-900/90 rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800">
        <span className="text-[10px] font-bold text-gray-400 tracking-wider">ROOM VIEW</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            {inRoom.length}/{roomCapacity}
          </span>
          {isOvercrowded && (
            <motion.span
              className="text-[9px] text-red-400 font-bold"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              CROWDED
            </motion.span>
          )}
        </div>
      </div>

      <div className="relative" style={{ paddingBottom: '60%' }}>
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="roomGlow">
              <stop offset="0%" stopColor={chaosColor} stopOpacity="0.05" />
              <stop offset="100%" stopColor={chaosColor} stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="5" y="5" width="90" height="90" rx="3" fill="url(#roomGlow)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />

          <rect x="35" y="35" width="30" height="30" rx="3" fill="rgba(100,116,139,0.15)" stroke="rgba(100,116,139,0.3)" strokeWidth="0.5" />
          <text x="50" y="48" textAnchor="middle" fill="rgba(148,163,184,0.4)" fontSize="5">PATIENT</text>

          {patient.cprInProgress && (
            <motion.circle
              cx="50"
              cy="52"
              r="4"
              fill="none"
              stroke="#ef4444"
              strokeWidth="0.5"
              animate={{ r: [4, 8, 4], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}

          <rect x="78" y="38" width="8" height="24" rx="1" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.3)" strokeWidth="0.3" />
          <text x="82" y="52" textAnchor="middle" fill="rgba(96,165,250,0.5)" fontSize="3" transform="rotate(90, 82, 52)">MONITOR</text>

          {assigned.map(member => {
            const pos = getStaffPosition(member, 0, 0);
            return <StaffAvatar key={member.id} member={member} x={pos.x} y={pos.y} />;
          })}

          {unassigned.map((member, i) => {
            const pos = getStaffPosition(member, i, unassigned.length);
            return <StaffAvatar key={member.id} member={member} x={pos.x} y={pos.y} />;
          })}
        </svg>
      </div>

      <div className="px-3 py-1.5 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-gray-500">CHAOS</span>
          <div className="flex-1 mx-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: chaosColor }}
              animate={{ width: `${chaosLevel}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-[9px] font-mono" style={{ color: chaosColor }}>{chaosLevel}%</span>
        </div>
      </div>
    </div>
  );
}
