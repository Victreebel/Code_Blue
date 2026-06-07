import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UIState } from '../../engine/ui/uiStateEngine';
import type { EngineActions } from '../../engine/useGameEngine';
import type { TeamMemberRuntime } from '../../engine/types/team';
import type { TeamRole } from '../../engine/types/core';
import {
  AMIODARONE_FIRST_DOSE_MG,
  AMIODARONE_SUBSEQUENT_DOSE_MG,
} from '../../engine/clinical/aclsConstants';

interface SpatialRoomViewProps {
  ui: UIState;
  actions: EngineActions;
}

interface MenuAction {
  label: string;
  sublabel?: string;
  onSelect: () => void;
  disabled?: boolean;
  variant: 'red' | 'amber' | 'blue' | 'gray' | 'green';
}

interface ActiveMenu {
  targetId: string;
  title: string;
  items: MenuAction[];
  anchor: { x: number; y: number };
}

const MEMBER_POSITIONS: Record<string, { x: number; y: number }> = {
  compressor:    { x: 50, y: 36 },
  airway:        { x: 50, y: 15 },
  monitor_defib: { x: 80, y: 36 },
  iv_access:     { x: 22, y: 52 },
  medication:    { x: 80, y: 55 },
  recorder:      { x: 18, y: 20 },
  timekeeper:    { x: 18, y: 79 },
  leader:        { x: 50, y: 82 },
  none:          { x: 90, y: 83 },
};

const ROLE_SHORT: Record<TeamRole, string> = {
  leader:        'Lead',
  compressor:    'CPR',
  airway:        'Airway',
  iv_access:     'IV',
  medication:    'Meds',
  monitor_defib: 'Defib',
  recorder:      'Rec',
  timekeeper:    'Time',
  none:          '—',
};

const ROLE_FULL: Record<TeamRole, string> = {
  leader:        'Code Leader',
  compressor:    'Compressor',
  airway:        'Airway Mgmt',
  iv_access:     'IV Access',
  medication:    'Medications',
  monitor_defib: 'Defib Op.',
  recorder:      'Recorder',
  timekeeper:    'Timekeeper',
  none:          'Unassigned',
};

function menuItemCls(variant: MenuAction['variant'], disabled?: boolean): string {
  if (disabled) return 'text-gray-600 cursor-not-allowed';
  const base = 'hover:opacity-90 cursor-pointer transition-opacity';
  switch (variant) {
    case 'red':   return `${base} bg-red-900/50 text-red-200`;
    case 'amber': return `${base} bg-amber-900/50 text-amber-200`;
    case 'blue':  return `${base} bg-blue-900/50 text-blue-200`;
    case 'green': return `${base} bg-green-900/50 text-green-200`;
    default:      return `${base} bg-gray-800/70 text-gray-300`;
  }
}

function clampAnchor(a: { x: number; y: number }): React.CSSProperties {
  return {
    left: `${Math.min(Math.max(a.x, 2), 62)}%`,
    top:  `${Math.min(Math.max(a.y, 2), 52)}%`,
  };
}

function NON_TERMINAL_open(orders: UIState['pendingOrders']) {
  const NT = new Set(['issued', 'heard', 'acknowledged', 'in_progress']);
  for (let i = orders.length - 1; i >= 0; i--) {
    if (NT.has(orders[i].status)) return orders[i];
  }
  return null;
}

export default function SpatialRoomView({ ui, actions }: SpatialRoomViewProps) {
  const [menu, setMenu] = useState<ActiveMenu | null>(null);

  const isShockable = ui.rhythm === 'vfib' || ui.rhythm === 'vtach';
  const isArrest    = isShockable || ui.rhythm === 'pea' || ui.rhythm === 'asystole';
  const isROSC      = !isArrest;
  const hasAccess   = ui.hasIVAccess || ui.hasIOAccess;
  const amioDose    = ui.amiodaroneDoses === 0
    ? AMIODARONE_FIRST_DOSE_MG
    : AMIODARONE_SUBSEQUENT_DOSE_MG;
  const openOrder   = NON_TERMINAL_open(ui.pendingOrders);

  const hasMedDelay = ui.pendingOrders.some(o => {
    if (o.type !== 'medication') return false;
    const NT = new Set(['issued', 'heard', 'acknowledged', 'in_progress']);
    return NT.has(o.status) && ui.clock - o.issuedAt > 25;
  });

  function open(m: ActiveMenu) { setMenu(m); }
  function close() { setMenu(null); }
  function act(fn: () => void) { fn(); close(); }

  function patientItems(): MenuAction[] {
    return [
      { label: ui.cprActive ? 'CPR Running' : 'Start CPR', variant: 'red',
        disabled: ui.cprActive,
        onSelect: () => act(actions.startCpr) },
      { label: 'Rhythm Check', variant: 'blue', onSelect: () => act(actions.rhythmCheck) },
      { label: 'Pulse Check',  variant: 'blue', onSelect: () => act(actions.pulseCheck)  },
    ];
  }

  function defibItems(): MenuAction[] {
    return [
      { label: ui.defibCharged ? 'CHARGED 200J' : 'Charge Defib 200J', variant: 'amber',
        disabled: !isShockable || ui.defibCharged,
        onSelect: () => act(actions.chargeDefib) },
      { label: `SHOCK (${ui.shockCount})`, variant: 'red',
        disabled: !ui.defibCharged,
        sublabel: ui.defibCharged ? 'Stand clear!' : undefined,
        onSelect: () => act(actions.shock) },
    ];
  }

  function medCartItems(): MenuAction[] {
    return [
      { label: 'Epinephrine 1mg',
        sublabel: hasAccess ? undefined : 'No IV/IO — drawn not given',
        variant: hasAccess ? 'blue' : 'amber',
        onSelect: () => act(() => actions.medication('epinephrine', 1)) },
      { label: `Amiodarone ${amioDose}mg`,
        sublabel: hasAccess ? undefined : 'No IV/IO — drawn not given',
        variant: hasAccess ? 'blue' : 'amber',
        onSelect: () => act(() => actions.medication('amiodarone', amioDose)) },
    ];
  }

  function airwayItems(): MenuAction[] {
    return [
      { label: 'Manage Airway (BVM)', variant: 'blue',
        onSelect: () => act(actions.airwayBvm) },
    ];
  }

  function memberItems(m: TeamMemberRuntime): MenuAction[] {
    const items: MenuAction[] = [];
    const isFatigued = m.fatigueLevel > 0.5;

    if (m.assignedRole === 'compressor') {
      items.push({ label: isFatigued ? 'Rotate Compressor ⚠' : 'Rotate Compressor',
        variant: isFatigued ? 'red' : 'gray',
        onSelect: () => act(actions.switchCompressor) });
    }

    items.push({ label: 'Assign as Compressor', variant: 'gray',
      onSelect: () => act(actions.assignCompressor) });

    if (openOrder) {
      const short = openOrder.label.length > 28
        ? openOrder.label.slice(0, 28) + '…'
        : openOrder.label;
      items.push({ label: `CLC: "${short}"`, variant: 'amber',
        onSelect: () => act(() => actions.requestClosedLoop(openOrder.id)) });
    }

    const QUICK: TeamRole[] = ['airway', 'iv_access', 'medication', 'monitor_defib', 'recorder'];
    for (const role of QUICK) {
      if (m.assignedRole !== role) {
        items.push({ label: `→ ${ROLE_FULL[role]}`, variant: 'gray',
          onSelect: () => act(() => actions.assignRole(m.id, role)) });
      }
    }

    return items;
  }

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-2 flex flex-col gap-1 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div className="text-[10px] text-gray-500 tracking-wider">ROOM — SPATIAL VIEW</div>
        {isROSC
          ? <div className="text-[10px] text-green-400 font-bold tracking-wider animate-pulse">ROSC</div>
          : !ui.cprActive && isArrest && ui.clock > 5
            ? <div className="text-[10px] text-red-400 font-bold tracking-wider animate-pulse">⚠ NO CPR</div>
            : null}
      </div>

      <div className="relative flex-1 min-h-0" style={{ aspectRatio: '4/3' }}>
        <div className="absolute inset-0 bg-gray-900/90 rounded border border-gray-800 overflow-hidden">

          {/* Floor grid */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.07]"
               preserveAspectRatio="none">
            {[20, 40, 60, 80].map(x =>
              <line key={`v${x}`} x1={`${x}%`} y1="0" x2={`${x}%`} y2="100%"
                    stroke="#6b7280" strokeWidth="1" />
            )}
            {[25, 50, 75].map(y =>
              <line key={`h${y}`} x1="0" y1={`${y}%`} x2="100%" y2={`${y}%`}
                    stroke="#6b7280" strokeWidth="1" />
            )}
          </svg>

          {/* Door label (decorative) */}
          <div className="absolute bottom-[2%] left-[3%] text-[7px] text-gray-700">◻ door</div>

          {/* ── AIRWAY STATION (top center, behind head of bed) ── */}
          <RoomObject
            label={ui.hasAdvancedAirway ? 'AIRWAY ✓' : 'AIRWAY'}
            sublabel={ui.hasAdvancedAirway ? 'Advanced' : 'BVM ready'}
            style={{ left: '27%', top: '3%', width: '46%', height: '16%' }}
            variant={ui.hasAdvancedAirway ? 'green' : 'neutral'}
            onClick={e => { e.stopPropagation();
              open({ targetId: 'airway', title: 'Airway Equipment',
                items: airwayItems(), anchor: { x: 27, y: 22 } }); }}
            title="Click to manage airway"
          />

          {/* ── PATIENT BED (center) ── */}
          <PatientBed
            cprActive={ui.cprActive}
            isROSC={isROSC}
            isArrest={isArrest}
            onClick={e => { e.stopPropagation();
              open({ targetId: 'patient', title: 'Patient',
                items: patientItems(), anchor: { x: 27, y: 56 } }); }}
          />

          {/* ── DEFIB / MONITOR (right wall) ── */}
          <RoomObject
            label={ui.defibCharged ? '⚡ 200J' : 'DEFIB'}
            sublabel={ui.shockCount > 0 ? `${ui.shockCount} shock${ui.shockCount > 1 ? 's' : ''}` : isShockable ? 'VF/VT!' : undefined}
            style={{ left: '72%', top: '26%', width: '22%', height: '26%' }}
            variant={ui.defibCharged ? 'amber-pulse' : isShockable ? 'amber' : 'neutral'}
            onClick={e => { e.stopPropagation();
              open({ targetId: 'defib', title: 'Monitor / Defib',
                items: defibItems(), anchor: { x: 35, y: 56 } }); }}
            title="Click to charge or shock"
          />

          {/* ── MED CART (left wall) ── */}
          <RoomObject
            label={hasMedDelay ? '⚠ MEDS' : 'MEDS'}
            sublabel={!hasAccess ? 'No IV/IO' : hasMedDelay ? 'delay' : undefined}
            style={{ left: '4%', top: '34%', width: '19%', height: '26%' }}
            variant={hasMedDelay ? 'orange' : 'neutral'}
            onClick={e => { e.stopPropagation();
              open({ targetId: 'medcart', title: 'Medication Cart',
                items: medCartItems(), anchor: { x: 25, y: 64 } }); }}
            title="Click to order medications"
          />

          {/* ── TEAM MEMBERS ── */}
          {ui.team.map(m => {
            const pos = MEMBER_POSITIONS[m.assignedRole] ?? MEMBER_POSITIONS.none;
            const isFatigued = m.fatigueLevel > 0.5;
            const hasSpeech  = !!m.speech && ui.clock < m.speech.until;
            return (
              <div
                key={m.id}
                className="absolute select-none"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)', zIndex: 10 }}
              >
                {/* Speech bubble */}
                {hasSpeech && (
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2
                                  bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5
                                  text-[7px] text-gray-200 whitespace-nowrap max-w-[110px]
                                  truncate z-20 pointer-events-none shadow-lg">
                    {m.speech!.text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                                    border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-600" />
                  </div>
                )}

                <motion.button
                  onClick={e => { e.stopPropagation();
                    open({ targetId: m.id, title: m.name,
                      items: memberItems(m),
                      anchor: { x: Math.min(pos.x + 3, 62), y: Math.min(pos.y + 5, 52) } }); }}
                  whileHover={{ scale: 1.15 }}
                  animate={isFatigued ? { scale: [1, 1.06, 1] } : {}}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center
                              text-[8px] font-bold border-2 cursor-pointer
                              ${m.isLeader
                                ? 'bg-amber-700 border-amber-300 text-amber-50'
                                : isFatigued
                                  ? 'bg-red-900 border-red-400 text-red-100'
                                  : m.confirmedRole
                                    ? 'bg-green-900 border-green-500 text-green-100'
                                    : 'bg-gray-800 border-gray-600 text-gray-300'}`}
                  title={`${m.name} — ${ROLE_FULL[m.assignedRole] ?? '—'}`}
                >
                  {m.name.split(' ')[0].slice(0, 3)}
                </motion.button>
                <div className="text-[7px] text-gray-500 text-center mt-0.5 leading-none pointer-events-none">
                  {ROLE_SHORT[m.assignedRole] ?? ''}
                  {isFatigued ? ' ⚠' : ''}
                </div>
              </div>
            );
          })}

          {/* ── CONTEXT MENU ── */}
          <AnimatePresence>
            {menu && (
              <>
                <div className="absolute inset-0 z-30" onClick={close} />
                <motion.div
                  className="absolute z-40 bg-gray-900 border border-gray-600 rounded-lg
                             shadow-2xl p-1.5 min-w-[148px] max-w-[200px]"
                  style={clampAnchor(menu.anchor)}
                  initial={{ opacity: 0, scale: 0.88, y: -4 }}
                  animate={{ opacity: 1, scale: 1,    y: 0 }}
                  exit={   { opacity: 0, scale: 0.88, y: -4 }}
                  transition={{ duration: 0.1 }}
                >
                  <div className="text-[9px] text-gray-400 font-semibold px-1.5 pb-1
                                  border-b border-gray-700 mb-1 truncate">
                    {menu.title}
                  </div>
                  {menu.items.map((item, i) => (
                    <button
                      key={i}
                      onClick={item.disabled ? undefined : item.onSelect}
                      disabled={item.disabled}
                      className={`w-full text-left text-[10px] px-2 py-1 rounded mb-0.5
                                  ${menuItemCls(item.variant, item.disabled)}`}
                    >
                      <div>{item.label}</div>
                      {item.sublabel && (
                        <div className="text-[8px] opacity-55 mt-0.5">{item.sublabel}</div>
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>

        </div>
      </div>

      <div className="text-[8px] text-gray-700 text-center shrink-0">
        Click patient · defib · med cart · airway · any person
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

interface RoomObjectProps {
  label: string;
  sublabel?: string;
  style: React.CSSProperties;
  variant: 'neutral' | 'amber' | 'amber-pulse' | 'green' | 'orange';
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
}

function RoomObject({ label, sublabel, style, variant, onClick, title }: RoomObjectProps) {
  const BG_MAP: Record<RoomObjectProps['variant'], string> = {
    neutral:      'bg-gray-900/80 border-gray-700 text-gray-500',
    amber:        'bg-amber-950/50 border-amber-800 text-amber-400',
    'amber-pulse':'bg-amber-900/70 border-amber-400 text-amber-200',
    green:        'bg-green-950/50 border-green-800 text-green-400',
    orange:       'bg-orange-950/50 border-orange-700 text-orange-300',
  };
  const bg = BG_MAP[variant];

  const pulse = variant === 'amber-pulse';

  return (
    <motion.button
      className={`absolute border rounded cursor-pointer flex flex-col items-center
                  justify-center gap-0.5 hover:brightness-125 transition-[filter] ${bg}`}
      style={style}
      animate={pulse
        ? { boxShadow: ['0 0 0 0 rgba(251,191,36,0.4)', '0 0 0 8px rgba(251,191,36,0)', '0 0 0 0 rgba(251,191,36,0.4)'] }
        : {}}
      transition={{ duration: 0.8, repeat: Infinity }}
      onClick={onClick}
      title={title}
    >
      <div className="text-[9px] font-bold">{label}</div>
      {sublabel && <div className="text-[7px] opacity-70">{sublabel}</div>}
    </motion.button>
  );
}

interface PatientBedProps {
  cprActive: boolean;
  isROSC: boolean;
  isArrest: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

function PatientBed({ cprActive, isROSC, isArrest, onClick }: PatientBedProps) {
  const bg = isROSC
    ? 'bg-green-950/60 border-green-700 text-green-300'
    : cprActive
      ? 'bg-red-950/60 border-red-700 text-red-300'
      : isArrest
        ? 'bg-red-950/30 border-red-900/60 text-red-500'
        : 'bg-blue-950/30 border-blue-900/50 text-blue-400';

  return (
    <motion.button
      className={`absolute border-2 rounded cursor-pointer flex flex-col items-center
                  justify-center gap-0.5 hover:brightness-125 transition-[filter] ${bg}`}
      style={{ left: '24%', top: '28%', width: '52%', height: '22%' }}
      animate={
        isROSC   ? { boxShadow: ['0 0 0 0 rgba(34,197,94,0.35)', '0 0 0 10px rgba(34,197,94,0)', '0 0 0 0 rgba(34,197,94,0.35)'] } :
        cprActive ? { boxShadow: ['0 0 0 0 rgba(239,68,68,0.45)', '0 0 0 10px rgba(239,68,68,0)', '0 0 0 0 rgba(239,68,68,0.45)'] } :
        {}
      }
      transition={{ duration: cprActive ? 0.6 : 1.2, repeat: Infinity }}
      onClick={onClick}
      title="Patient bed — click for CPR / assessment orders"
    >
      <div className="text-[11px] font-bold tracking-widest">
        {isROSC ? 'ROSC' : cprActive ? 'CPR' : 'PATIENT'}
      </div>
      {cprActive && (
        <div className="text-[7px] opacity-60">compressions in progress</div>
      )}
    </motion.button>
  );
}
