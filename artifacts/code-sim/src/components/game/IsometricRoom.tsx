import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type TeamMember, type TeamRole, type PatientState, type MedicationType,
  type ReversibleCause, type PendingOrder,
  TEAM_ROLE_LABELS, STAFF_TYPE_LABELS,
} from '../../engine/types';
import { isShockable } from '../../engine/aclsProtocol';

interface IsometricRoomProps {
  team: TeamMember[];
  patient: PatientState;
  clock: number;
  roomCapacity: number;
  chaosLevel: number;
  defibCharged: boolean;
  pendingOrders: PendingOrder[];
  actions: {
    assignRole: (id: string, role: TeamRole) => void;
    confirmRole: (id: string) => void;
    kickMember: (id: string) => void;
    orderCPR: () => void;
    orderStopCPR: () => void;
    orderRhythmCheck: () => void;
    orderPulseCheck: () => void;
    orderShock: () => void;
    chargeDefib: () => void;
    requestCompressorSwitch: () => void;
    clearRoom: () => void;
    orderMedication: (med: MedicationType, dose: string) => void;
    orderAirway: (advanced: boolean) => void;
    orderIVAccess: (io: boolean) => void;
    identifyCause: (cause: ReversibleCause) => void;
    treatCause: () => void;
  };
}

const ROLE_POSITIONS: Record<string, { x: number; y: number }> = {
  compressor: { x: 50, y: 38 },
  airway: { x: 50, y: 62 },
  monitor_defib: { x: 78, y: 45 },
  iv_access: { x: 22, y: 42 },
  recorder: { x: 80, y: 25 },
  medication: { x: 22, y: 58 },
  timekeeper: { x: 80, y: 65 },
};

const STAFF_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  attending: { bg: '#b45309', border: '#f59e0b', text: '#fde68a' },
  resident: { bg: '#1e40af', border: '#3b82f6', text: '#bfdbfe' },
  nurse: { bg: '#065f46', border: '#10b981', text: '#a7f3d0' },
  rt: { bg: '#5b21b6', border: '#8b5cf6', text: '#ddd6fe' },
  tech: { bg: '#374151', border: '#6b7280', text: '#d1d5db' },
  pharmacist: { bg: '#9d174d', border: '#ec4899', text: '#fbcfe8' },
  student: { bg: '#475569', border: '#94a3b8', text: '#e2e8f0' },
};

const ROLE_SHORT_LABELS: Record<TeamRole, string> = {
  compressor: 'CPR',
  airway: 'Airway',
  iv_access: 'IV/IO',
  medication: 'Meds',
  monitor_defib: 'Defib',
  recorder: 'Record',
  timekeeper: 'Timer',
  none: '',
};

function getStaffPosition(member: TeamMember, index: number, totalUnassigned: number): { x: number; y: number } {
  if (member.assignedRole !== 'none' && ROLE_POSITIONS[member.assignedRole]) {
    return ROLE_POSITIONS[member.assignedRole];
  }
  const baseAngle = -Math.PI * 0.75;
  const arcSpan = Math.PI * 1.5;
  const angle = baseAngle + (index / Math.max(totalUnassigned - 1, 1)) * arcSpan;
  const rx = 40;
  const ry = 32;
  return {
    x: 50 + Math.cos(angle) * rx,
    y: 50 + Math.sin(angle) * ry,
  };
}

function depthScale(y: number): number {
  return 0.7 + (y / 100) * 0.5;
}

function depthZ(y: number): number {
  return Math.floor(y);
}

type SelectedTarget = { type: 'staff'; id: string } | { type: 'patient' } | { type: 'defib' } | { type: 'door' } | null;

function StaffEntity({
  member, x, y, isSelected, onSelect, clock,
}: {
  member: TeamMember;
  x: number;
  y: number;
  isSelected: boolean;
  onSelect: () => void;
  clock: number;
}) {
  const colors = STAFF_COLORS[member.staffType] || STAFF_COLORS.tech;
  const scale = depthScale(y);
  const isCompressor = member.assignedRole === 'compressor';
  const isBusy = member.busy;
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <motion.div
      className="absolute cursor-pointer select-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        zIndex: depthZ(y) + (isSelected ? 100 : 0),
        transform: 'translate(-50%, -50%)',
      }}
      animate={{
        left: `${x}%`,
        top: isCompressor ? [`${y}%`, `${y - 1.2}%`, `${y}%`] : `${y}%`,
        scale: scale,
      }}
      transition={isCompressor
        ? { top: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }, left: { type: 'spring', stiffness: 50, damping: 15 } }
        : { type: 'spring', stiffness: 50, damping: 15 }
      }
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="relative flex flex-col items-center">
        <AnimatePresence>
          {member.speechBubble && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.8 }}
              className="absolute bottom-full mb-2 whitespace-nowrap max-w-[180px]"
              style={{ zIndex: 200 }}
            >
              <div className="bg-white/95 text-gray-900 text-[11px] px-2.5 py-1.5 rounded-lg shadow-lg leading-tight">
                "{(member.speechBubble ?? '').slice(0, 50)}"
              </div>
              <div className="w-2.5 h-2.5 bg-white/95 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="relative rounded-full flex items-center justify-center transition-shadow"
          style={{
            width: 48,
            height: 48,
            backgroundColor: colors.bg,
            borderWidth: isSelected ? 3 : 2,
            borderColor: isSelected ? '#fff' : colors.border,
            borderStyle: 'solid',
            boxShadow: isSelected
              ? `0 0 20px ${colors.border}80, 0 4px 12px rgba(0,0,0,0.5)`
              : `0 2px 8px rgba(0,0,0,0.4)`,
          }}
          animate={isBusy && !isCompressor ? { rotate: [0, -3, 3, 0] } : {}}
          transition={isBusy ? { duration: 2, repeat: Infinity } : {}}
        >
          <span className="text-sm font-bold" style={{ color: colors.text }}>{initials}</span>

          {member.assignedRole !== 'none' && (
            <div
              className="absolute -top-1 -right-1 rounded-full text-[8px] font-bold px-1.5 py-0.5 leading-none"
              style={{ backgroundColor: colors.border, color: '#fff' }}
            >
              {ROLE_SHORT_LABELS[member.assignedRole]}
            </div>
          )}

          {isBusy && (
            <motion.div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-yellow-500"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          )}

          {member.behavior.distractibility > 0.6 && member.assignedRole === 'none' && (
            <motion.div
              className="absolute -top-1 -left-1 text-[10px]"
              animate={{ opacity: [0.5, 1, 0.5], rotate: [0, 15, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ?
            </motion.div>
          )}

          {!member.confirmedRole && member.assignedRole !== 'none' && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-yellow-400"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </motion.div>

        <div className="mt-1 text-center" style={{ minWidth: 60 }}>
          <div className="text-[10px] font-semibold text-white leading-tight drop-shadow-md truncate max-w-[80px]">
            {member.name.split(' ')[0]}
          </div>
          <div className="text-[8px] leading-tight drop-shadow-md" style={{ color: colors.text }}>
            {STAFF_TYPE_LABELS[member.staffType]}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ContextMenu({
  target, team, patient, defibCharged, actions, onClose, position,
}: {
  target: SelectedTarget;
  team: TeamMember[];
  patient: PatientState;
  defibCharged: boolean;
  actions: IsometricRoomProps['actions'];
  onClose: () => void;
  position: { x: number; y: number };
}) {
  if (!target) return null;

  const ROLE_OPTIONS: TeamRole[] = ['compressor', 'airway', 'iv_access', 'medication', 'monitor_defib', 'recorder', 'timekeeper'];

  const menuBtn = (label: string, onClick: () => void, color: string, disabled = false) => (
    <button
      key={label}
      onClick={(e) => { e.stopPropagation(); onClick(); onClose(); }}
      disabled={disabled}
      className={`w-full text-left text-[11px] px-3 py-1.5 rounded transition-all ${disabled
        ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
        : `${color} hover:brightness-125 active:scale-[0.97]`
      }`}
    >
      {label}
    </button>
  );

  let title = '';
  let content: React.ReactNode = null;

  if (target.type === 'staff') {
    const member = team.find(m => m.id === target.id);
    if (!member) return null;
    title = `${member.name} (${STAFF_TYPE_LABELS[member.staffType]})`;
    content = (
      <>
        <div className="text-[10px] text-gray-500 mb-1 font-semibold">ASSIGN ROLE</div>
        <div className="grid grid-cols-2 gap-1 mb-2">
          {ROLE_OPTIONS.map(role => (
            <button
              key={role}
              onClick={(e) => { e.stopPropagation(); actions.assignRole(member.id, role); onClose(); }}
              className={`text-[10px] px-2 py-1 rounded transition-colors ${
                member.assignedRole === role
                  ? 'bg-blue-700 text-white font-bold'
                  : 'bg-blue-900/50 text-blue-300 hover:bg-blue-800/70'
              }`}
            >
              {TEAM_ROLE_LABELS[role]}
            </button>
          ))}
        </div>
        {member.assignedRole === 'medication' && (
          <>
            <div className="border-t border-gray-700 my-1.5" />
            <div className="text-[10px] text-gray-500 mb-1 font-semibold">GIVE MEDICATION</div>
            {menuBtn('Epinephrine 1mg', () => actions.orderMedication('epinephrine', '1mg IV/IO'), 'bg-blue-900/50 text-blue-300', !patient.hasIV && !patient.hasIO)}
            {menuBtn(`Amiodarone ${patient.amiodaroneDoses === 0 ? '300mg' : '150mg'}`, () => actions.orderMedication('amiodarone', patient.amiodaroneDoses === 0 ? '300mg IV/IO' : '150mg IV/IO'), 'bg-blue-900/50 text-blue-300', (!patient.hasIV && !patient.hasIO) || patient.amiodaroneDoses >= 2)}
          </>
        )}
        {member.assignedRole === 'iv_access' && !patient.hasIV && !patient.hasIO && (
          <>
            <div className="border-t border-gray-700 my-1.5" />
            <div className="text-[10px] text-gray-500 mb-1 font-semibold">ACCESS</div>
            {menuBtn('Start IV', () => actions.orderIVAccess(false), 'bg-teal-900/50 text-teal-300')}
            {menuBtn('Place IO', () => actions.orderIVAccess(true), 'bg-teal-900/50 text-teal-300')}
          </>
        )}
        {member.assignedRole === 'airway' && (
          <>
            <div className="border-t border-gray-700 my-1.5" />
            <div className="text-[10px] text-gray-500 mb-1 font-semibold">AIRWAY</div>
            {menuBtn('BVM Ventilation', () => actions.orderAirway(false), 'bg-cyan-900/50 text-cyan-300')}
            {menuBtn('Advanced Airway', () => actions.orderAirway(true), 'bg-cyan-900/50 text-cyan-300', patient.hasAdvancedAirway)}
          </>
        )}
        <div className="border-t border-gray-700 my-1.5" />
        <div className="flex gap-1.5">
          {!member.confirmedRole && member.assignedRole !== 'none' && (
            menuBtn('Confirm', () => actions.confirmRole(member.id), 'bg-green-900/60 text-green-300')
          )}
          {menuBtn('Remove', () => actions.kickMember(member.id), 'bg-red-900/50 text-red-300')}
        </div>
      </>
    );
  } else if (target.type === 'patient') {
    title = 'Patient';
    content = (
      <>
        {!patient.cprInProgress
          ? menuBtn('Start CPR', actions.orderCPR, 'bg-red-900/60 text-red-300')
          : menuBtn('Hold CPR', actions.orderStopCPR, 'bg-yellow-900/60 text-yellow-300')
        }
        {menuBtn('Rhythm Check', actions.orderRhythmCheck, 'bg-green-900/60 text-green-300')}
        {menuBtn('Pulse Check', actions.orderPulseCheck, 'bg-pink-900/60 text-pink-300')}
        {menuBtn('Switch Compressor', actions.requestCompressorSwitch, 'bg-amber-900/60 text-amber-300')}
        <div className="border-t border-gray-700 my-1.5" />
        <div className="text-[10px] text-gray-500 mb-1 font-semibold">AIRWAY / ACCESS</div>
        {menuBtn('BVM Ventilation', () => actions.orderAirway(false), 'bg-cyan-900/60 text-cyan-300')}
        {menuBtn('Advanced Airway', () => actions.orderAirway(true), 'bg-cyan-900/60 text-cyan-300', patient.hasAdvancedAirway)}
        {menuBtn('Start IV', () => actions.orderIVAccess(false), 'bg-teal-900/60 text-teal-300', patient.hasIV)}
        {menuBtn('Place IO', () => actions.orderIVAccess(true), 'bg-teal-900/60 text-teal-300', patient.hasIO)}
      </>
    );
  } else if (target.type === 'defib') {
    title = 'Defibrillator / Monitor';
    content = (
      <>
        {menuBtn(
          defibCharged ? 'CHARGED - Ready' : 'Charge (200J)',
          actions.chargeDefib,
          defibCharged ? 'bg-orange-800/80 text-orange-200 font-bold' : 'bg-orange-900/60 text-orange-300',
          defibCharged,
        )}
        {menuBtn(
          'SHOCK',
          actions.orderShock,
          'bg-orange-900/60 text-orange-300',
          !isShockable(patient.rhythm) || !defibCharged,
        )}
        {!defibCharged && isShockable(patient.rhythm) && (
          <p className="text-[9px] text-orange-400 mt-1">Charge defib first</p>
        )}
        <div className="border-t border-gray-700 my-1.5" />
        <div className="text-[10px] text-gray-500 mb-1 font-semibold">MEDICATIONS</div>
        {menuBtn('Epinephrine 1mg', () => actions.orderMedication('epinephrine', '1mg IV/IO'), 'bg-blue-900/60 text-blue-300', !patient.hasIV && !patient.hasIO)}
        {menuBtn(`Amiodarone ${patient.amiodaroneDoses === 0 ? '300mg' : '150mg'}`, () => actions.orderMedication('amiodarone', patient.amiodaroneDoses === 0 ? '300mg IV/IO' : '150mg IV/IO'), 'bg-blue-900/60 text-blue-300', (!patient.hasIV && !patient.hasIO) || patient.amiodaroneDoses >= 2)}
        {menuBtn('Lidocaine 100mg', () => actions.orderMedication('lidocaine', '100mg IV'), 'bg-blue-900/60 text-blue-300', !patient.hasIV && !patient.hasIO)}
        {menuBtn('Bicarb 1mEq/kg', () => actions.orderMedication('bicarb', '1mEq/kg IV'), 'bg-blue-900/60 text-blue-300', !patient.hasIV && !patient.hasIO)}
        {menuBtn('Calcium 1g', () => actions.orderMedication('calcium', '1g IV'), 'bg-blue-900/60 text-blue-300', !patient.hasIV && !patient.hasIO)}
        {menuBtn('Magnesium 2g', () => actions.orderMedication('magnesium', '2g IV'), 'bg-blue-900/60 text-blue-300', !patient.hasIV && !patient.hasIO)}
        {(!patient.hasIV && !patient.hasIO) && (
          <p className="text-[9px] text-red-400 mt-1">No IV/IO access</p>
        )}
      </>
    );
  } else if (target.type === 'door') {
    title = 'Room Entrance';
    content = (
      <>
        {menuBtn('Clear Room (Non-Essential)', actions.clearRoom, 'bg-gray-700 text-gray-200')}
      </>
    );
  }

  const menuStyle: React.CSSProperties = {
    left: `${Math.min(Math.max(position.x, 10), 70)}%`,
    top: `${Math.min(Math.max(position.y, 5), 60)}%`,
    zIndex: 500,
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.15 }}
      className="absolute"
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-gray-900/95 backdrop-blur-md border border-gray-600 rounded-xl p-3 shadow-2xl min-w-[200px] max-w-[280px] max-h-[400px] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white">{title}</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm leading-none px-1">x</button>
        </div>
        <div className="space-y-1">
          {content}
        </div>
      </div>
    </motion.div>
  );
}

export default function IsometricRoom({
  team, patient, clock, roomCapacity, chaosLevel, defibCharged, pendingOrders, actions,
}: IsometricRoomProps) {
  const [selected, setSelected] = useState<SelectedTarget>(null);
  const [menuPos, setMenuPos] = useState({ x: 50, y: 50 });

  const inRoom = useMemo(() => team.filter(m => m.inRoom), [team]);
  const assigned = useMemo(() => inRoom.filter(m => m.assignedRole !== 'none'), [inRoom]);
  const unassigned = useMemo(() => inRoom.filter(m => m.assignedRole === 'none'), [inRoom]);
  const isOvercrowded = inRoom.length > roomCapacity;

  const handleSelect = useCallback((target: SelectedTarget, x: number, y: number) => {
    if (selected && selected.type === target?.type && (target?.type !== 'staff' || (selected as any).id === (target as any).id)) {
      setSelected(null);
    } else {
      setSelected(target);
      setMenuPos({ x, y });
    }
  }, [selected]);

  const handleBackgroundClick = useCallback(() => {
    setSelected(null);
  }, []);

  const chaosOpacity = Math.min(chaosLevel / 100, 1) * 0.25;
  const chaosTint = chaosLevel > 60 ? 'rgba(239,68,68,' : chaosLevel > 30 ? 'rgba(245,158,11,' : 'rgba(34,197,94,';

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        perspective: '800px',
        backgroundColor: '#0c1220',
      }}
      onClick={handleBackgroundClick}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: 'rotateX(25deg) scale(0.95)',
          transformOrigin: 'center 60%',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="absolute inset-[5%] rounded-lg" style={{
          background: 'linear-gradient(180deg, #1a2332 0%, #0f1923 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)',
        }}>
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`h${i}`} x1="0%" y1={`${(i + 1) * (100 / 13)}%`} x2="100%" y2={`${(i + 1) * (100 / 13)}%`} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`v${i}`} x1={`${(i + 1) * (100 / 13)}%`} y1="0%" x2={`${(i + 1) * (100 / 13)}%`} y2="100%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            ))}
          </svg>
        </div>
      </div>

      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        <div
          className="absolute rounded-lg"
          style={{
            left: '35%', top: '35%', width: '30%', height: '26%',
            background: 'linear-gradient(135deg, rgba(100,116,139,0.12) 0%, rgba(71,85,105,0.08) 100%)',
            border: '2px solid rgba(100,116,139,0.25)',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: depthZ(48),
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-gray-600 text-[11px] font-semibold tracking-wider">PATIENT</span>
          </div>
          {patient.cprInProgress && (
            <>
              <motion.div
                className="absolute inset-0 rounded-lg"
                style={{ border: '2px solid rgba(239,68,68,0.4)' }}
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/20"
                animate={{ width: ['20px', '60px', '20px'], height: ['20px', '60px', '20px'], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </>
          )}
        </div>

        <div
          className="absolute rounded"
          style={{
            left: '31%', top: '30%', width: '7%', height: '5%',
            background: 'rgba(100,116,139,0.1)',
            border: '1px solid rgba(100,116,139,0.2)',
            zIndex: depthZ(30),
          }}
        >
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-700 text-[7px]">PILLOW</span>
          </div>
        </div>
      </div>

      <div
        className="absolute cursor-pointer"
        style={{
          left: '74%', top: '30%', width: '12%', height: '22%',
          zIndex: depthZ(40),
          pointerEvents: 'auto',
        }}
        onClick={(e) => { e.stopPropagation(); handleSelect({ type: 'defib' }, 78, 35); }}
      >
        <div className="w-full h-full rounded-lg" style={{
          background: defibCharged
            ? 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(234,88,12,0.15) 100%)'
            : 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.08) 100%)',
          border: defibCharged ? '2px solid rgba(249,115,22,0.5)' : '1px solid rgba(59,130,246,0.3)',
          boxShadow: defibCharged ? '0 0 15px rgba(249,115,22,0.2)' : '0 2px 10px rgba(0,0,0,0.3)',
        }}>
          <div className="flex flex-col items-center justify-center h-full gap-0.5">
            <span className="text-[8px] font-bold tracking-wider" style={{ color: defibCharged ? '#fb923c' : '#60a5fa' }}>DEFIB</span>
            <span className="text-[7px] text-gray-500">MONITOR</span>
            {defibCharged && (
              <motion.div
                className="text-[9px] font-bold text-orange-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                CHARGED
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div
        className="absolute cursor-pointer"
        style={{
          left: '14%', top: '28%', width: '10%', height: '18%',
          zIndex: depthZ(35),
          pointerEvents: 'auto',
        }}
      >
        <div className="w-full h-full rounded-lg" style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.05) 100%)',
          border: '1px solid rgba(245,158,11,0.2)',
        }}>
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-[8px] font-bold text-amber-700 tracking-wider">CRASH</span>
            <span className="text-[7px] text-amber-800">CART</span>
          </div>
        </div>
      </div>

      <div
        className="absolute cursor-pointer"
        style={{
          left: '42%', top: '88%', width: '16%', height: '10%',
          zIndex: depthZ(92),
          pointerEvents: 'auto',
        }}
        onClick={(e) => { e.stopPropagation(); handleSelect({ type: 'door' }, 50, 85); }}
      >
        <div className="w-full h-full rounded-t-lg" style={{
          background: 'linear-gradient(0deg, rgba(75,85,99,0.3) 0%, rgba(75,85,99,0.05) 100%)',
          borderTop: '2px solid rgba(75,85,99,0.4)',
          borderLeft: '1px solid rgba(75,85,99,0.2)',
          borderRight: '1px solid rgba(75,85,99,0.2)',
        }}>
          <div className="flex items-center justify-center h-full">
            <span className="text-[9px] text-gray-500 font-semibold tracking-wider">DOOR</span>
          </div>
        </div>
      </div>

      <div
        className="absolute cursor-pointer"
        style={{
          left: '35%', top: '35%', width: '30%', height: '26%',
          zIndex: depthZ(48),
          pointerEvents: 'auto',
        }}
        onClick={(e) => { e.stopPropagation(); handleSelect({ type: 'patient' }, 50, 42); }}
      />

      {assigned.map(member => {
        const pos = ROLE_POSITIONS[member.assignedRole] || { x: 50, y: 50 };
        return (
          <StaffEntity
            key={member.id}
            member={member}
            x={pos.x}
            y={pos.y}
            isSelected={selected?.type === 'staff' && selected.id === member.id}
            onSelect={() => handleSelect({ type: 'staff', id: member.id }, pos.x, pos.y)}
            clock={clock}
          />
        );
      })}

      {unassigned.map((member, i) => {
        const pos = getStaffPosition(member, i, unassigned.length);
        return (
          <StaffEntity
            key={member.id}
            member={member}
            x={pos.x}
            y={pos.y}
            isSelected={selected?.type === 'staff' && selected.id === member.id}
            onSelect={() => handleSelect({ type: 'staff', id: member.id }, pos.x, pos.y)}
            clock={clock}
          />
        );
      })}

      <AnimatePresence>
        {selected && (
          <ContextMenu
            target={selected}
            team={team}
            patient={patient}
            defibCharged={defibCharged}
            actions={actions}
            onClose={() => setSelected(null)}
            position={menuPos}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chaosLevel > 20 && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: chaosOpacity }}
            exit={{ opacity: 0 }}
            style={{
              background: `radial-gradient(ellipse at center, ${chaosTint}0.3) 0%, ${chaosTint}0) 70%)`,
              zIndex: 300,
            }}
          />
        )}
      </AnimatePresence>

      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2" style={{ zIndex: 400 }}>
        <span className="text-[9px] text-gray-500 font-bold">CHAOS</span>
        <div className="flex-1 h-1.5 bg-gray-800/80 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: chaosLevel > 60 ? '#ef4444' : chaosLevel > 30 ? '#f59e0b' : '#22c55e' }}
            animate={{ width: `${chaosLevel}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <span className="text-[9px] font-mono font-bold" style={{
          color: chaosLevel > 60 ? '#ef4444' : chaosLevel > 30 ? '#f59e0b' : '#22c55e'
        }}>{chaosLevel}%</span>
      </div>

      <div className="absolute top-2 left-2 flex items-center gap-2" style={{ zIndex: 400 }}>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${isOvercrowded ? 'bg-red-900/80 text-red-300 animate-pulse' : 'bg-gray-800/80 text-gray-400'}`}>
          {inRoom.length}/{roomCapacity}
        </span>
        {isOvercrowded && <span className="text-[9px] text-red-400 font-bold">CROWDED</span>}
      </div>
    </div>
  );
}
