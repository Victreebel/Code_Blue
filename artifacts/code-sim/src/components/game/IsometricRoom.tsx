import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UIState } from '../../engine/ui/uiStateEngine';
import type { EngineActions } from '../../engine/useGameEngine';
import type { TeamMemberRuntime } from '../../engine/types/team';
import type { TeamRole } from '../../engine/types/core';
import { AMIODARONE_FIRST_DOSE_MG, AMIODARONE_SUBSEQUENT_DOSE_MG } from '../../engine/clinical/aclsConstants';

const ROOM_W = 1000;
const ROOM_H = 580;

/* ── Isometric geometry helpers ───────────────────────────────────── */

function isoFloor(cx: number, cy: number, w: number, h: number): string {
  return [
    `${cx},${cy - h / 2}`,
    `${cx + w / 2},${cy}`,
    `${cx},${cy + h / 2}`,
    `${cx - w / 2},${cy}`,
  ].join(' ');
}

function isoLeftFace(cx: number, cy: number, w: number, h: number, fh: number): string {
  return [
    `${cx - w / 2},${cy}`,
    `${cx},${cy + h / 2}`,
    `${cx},${cy + h / 2 + fh}`,
    `${cx - w / 2},${cy + fh}`,
  ].join(' ');
}

function isoRightFace(cx: number, cy: number, w: number, h: number, fh: number): string {
  return [
    `${cx + w / 2},${cy}`,
    `${cx},${cy + h / 2}`,
    `${cx},${cy + h / 2 + fh}`,
    `${cx + w / 2},${cy + fh}`,
  ].join(' ');
}

/* ── Room object definitions ──────────────────────────────────────── */

interface RoomZone {
  id: ZoneId;
  cx: number;
  cy: number;
  w: number;
  h: number;
  fh: number;
  topFill: string;
  topStroke: string;
  leftFill: string;
  rightFill: string;
  labelColor: string;
  label: string;
}

type ZoneId = 'patient_bed' | 'defib_station' | 'medication_station' | 'airway_station' | 'door';

const ZONES: RoomZone[] = [
  {
    id: 'airway_station',
    cx: 500, cy: 110, w: 200, h: 100, fh: 22,
    topFill: '#2d2a1a', topStroke: '#f59e0b',
    leftFill: '#1a1808', rightFill: '#211e0d',
    labelColor: '#fcd34d', label: 'AIRWAY',
  },
  {
    id: 'medication_station',
    cx: 240, cy: 210, w: 190, h: 95, fh: 20,
    topFill: '#1a2e1a', topStroke: '#22c55e',
    leftFill: '#0d1a0d', rightFill: '#112111',
    labelColor: '#86efac', label: 'MEDS',
  },
  {
    id: 'defib_station',
    cx: 760, cy: 210, w: 190, h: 95, fh: 20,
    topFill: '#3b1f1f', topStroke: '#ef4444',
    leftFill: '#1f0f0f', rightFill: '#2d1515',
    labelColor: '#fca5a5', label: 'DEFIB',
  },
  {
    id: 'patient_bed',
    cx: 500, cy: 320, w: 260, h: 130, fh: 28,
    topFill: '#1e3a5f', topStroke: '#3b82f6',
    leftFill: '#0e1e30', rightFill: '#142a45',
    labelColor: '#93c5fd', label: 'PATIENT',
  },
  {
    id: 'door',
    cx: 500, cy: 480, w: 100, h: 50, fh: 10,
    topFill: '#1f2937', topStroke: '#6b7280',
    leftFill: '#111827', rightFill: '#1a2535',
    labelColor: '#9ca3af', label: 'DOOR',
  },
];

/* ── Avatar positions (percentage of container) ───────────────────── */

const ROLE_POSITIONS: Record<TeamRole, { x: number; y: number }> = {
  airway:        { x: 50, y: 14 },
  monitor_defib: { x: 79, y: 31 },
  medication:    { x: 22, y: 30 },
  iv_access:     { x: 30, y: 43 },
  compressor:    { x: 50, y: 46 },
  leader:        { x: 64, y: 55 },
  recorder:      { x: 16, y: 18 },
  timekeeper:    { x: 18, y: 65 },
  none:          { x: 88, y: 72 },
};

const ROLE_SHORT: Record<TeamRole, string> = {
  leader: 'Lead', compressor: 'CPR', airway: 'Airway',
  iv_access: 'IV', medication: 'Meds', monitor_defib: 'Defib',
  recorder: 'Rec', timekeeper: 'Time', none: '—',
};

const ROLE_FULL: Record<TeamRole, string> = {
  leader: 'Code Leader', compressor: 'Compressor', airway: 'Airway Mgmt',
  iv_access: 'IV Access', medication: 'Medications', monitor_defib: 'Defib Op.',
  recorder: 'Recorder', timekeeper: 'Timekeeper', none: 'Unassigned',
};

/* ── Context menu types ──────────────────────────────────────────── */

interface MenuAction {
  label: string;
  sublabel?: string;
  onSelect: () => void;
  disabled?: boolean;
  variant: 'red' | 'amber' | 'blue' | 'gray' | 'green' | 'amberFilled';
}

interface ActiveMenu {
  targetId: string;
  title: string;
  items: MenuAction[];
  anchor: { x: number; y: number };
}

function menuItemCls(variant: MenuAction['variant'], disabled?: boolean): string {
  if (disabled) return 'text-gray-600 cursor-not-allowed bg-gray-900/40';
  const base = 'hover:brightness-110 cursor-pointer transition-[filter]';
  switch (variant) {
    case 'red':        return `${base} bg-red-900/60 text-red-200`;
    case 'amber':      return `${base} bg-amber-900/50 text-amber-200`;
    case 'amberFilled':return `bg-amber-700 text-amber-50 cursor-default`;
    case 'blue':       return `${base} bg-blue-900/50 text-blue-200`;
    case 'green':      return `${base} bg-green-900/50 text-green-200`;
    default:           return `${base} bg-gray-800/70 text-gray-300`;
  }
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const NON_TERMINAL = new Set(['issued', 'heard', 'acknowledged', 'in_progress']);

/* ── Main component ───────────────────────────────────────────────── */

interface IsometricRoomProps {
  ui: UIState;
  actions: EngineActions;
}

export default function IsometricRoom({ ui, actions }: IsometricRoomProps) {
  const [menu, setMenu] = useState<ActiveMenu | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isShockable = ui.rhythm === 'vfib' || ui.rhythm === 'vtach';
  const isArrest = isShockable || ui.rhythm === 'pea' || ui.rhythm === 'asystole';
  const hasAccess = ui.hasIVAccess || ui.hasIOAccess;
  const amioDose = ui.amiodaroneDoses === 0 ? AMIODARONE_FIRST_DOSE_MG : AMIODARONE_SUBSEQUENT_DOSE_MG;
  const openOrder = [...ui.pendingOrders].reverse().find(o => NON_TERMINAL.has(o.status)) ?? null;

  const chaosRatio = Math.min(1, ui.chaosFiredCount / 8);

  function close() { setMenu(null); }
  function act(fn: () => void) { fn(); close(); }

  function anchorStyle(pct: { x: number; y: number }): React.CSSProperties {
    const x = clamp(pct.x, 5, 78);
    const y = clamp(pct.y, 5, 68);
    return { left: `${x}%`, top: `${y}%` };
  }

  /* ── Zone menus ── */
  function patientMenu(): MenuAction[] {
    return [
      { label: ui.cprActive ? 'CPR Running…' : 'Start CPR', variant: 'red',
        disabled: ui.cprActive, onSelect: () => act(actions.startCpr) },
      { label: 'Rotate Compressor', variant: 'gray', onSelect: () => act(actions.switchCompressor) },
      { label: 'Rhythm Check', variant: 'blue', onSelect: () => act(actions.rhythmCheck) },
      { label: 'Pulse Check', variant: 'blue', onSelect: () => act(actions.pulseCheck) },
      ...(openOrder ? [{
        label: `CLC: "${openOrder.label.slice(0, 22)}${openOrder.label.length > 22 ? '…' : ''}"`,
        variant: 'amber' as const,
        onSelect: () => act(() => actions.requestClosedLoop(openOrder.id)),
      }] : []),
    ];
  }

  function defibMenu(): MenuAction[] {
    return [
      { label: ui.defibCharged ? 'CHARGED 200J' : 'Charge Defib 200J', variant: ui.defibCharged ? 'amberFilled' : 'amber',
        disabled: !isShockable || ui.defibCharged,
        onSelect: () => act(actions.chargeDefib) },
      { label: `SHOCK (${ui.shockCount})`, variant: 'red',
        disabled: !ui.defibCharged,
        sublabel: ui.defibCharged ? 'Stand clear!' : undefined,
        onSelect: () => act(actions.shock) },
    ];
  }

  function medicationMenu(): MenuAction[] {
    return [
      { label: 'Epinephrine 1mg',
        sublabel: hasAccess ? 'IV/IO' : 'No IV/IO',
        variant: hasAccess ? 'blue' : 'amber',
        onSelect: () => act(() => actions.medication('epinephrine', 1)) },
      { label: `Amiodarone ${amioDose}mg`,
        sublabel: hasAccess ? 'IV/IO' : 'No IV/IO',
        variant: hasAccess ? 'blue' : 'amber',
        onSelect: () => act(() => actions.medication('amiodarone', amioDose)) },
      { label: 'Establish IV Access', variant: 'gray', onSelect: () => act(actions.ivAccess) },
      { label: 'Establish IO Access', variant: 'gray', onSelect: () => act(actions.ioAccess) },
    ];
  }

  function airwayMenu(): MenuAction[] {
    return [
      { label: 'BVM / Bag-Valve Mask', variant: 'blue', onSelect: () => act(actions.airwayBvm) },
      { label: 'Advanced Airway',
        sublabel: ui.hasAdvancedAirway ? '✓ In place' : undefined,
        variant: ui.hasAdvancedAirway ? 'green' : 'gray',
        disabled: ui.hasAdvancedAirway,
        onSelect: () => act(actions.airwayAdvanced) },
    ];
  }

  function doorMenu(): MenuAction[] {
    return [
      { label: 'Announce Cycle', variant: 'gray', onSelect: () => act(actions.announceCycle) },
      { label: 'Call Time of Death', variant: 'red', onSelect: () => act(actions.callTimeOfDeath) },
    ];
  }

  function memberMenu(m: TeamMemberRuntime): MenuAction[] {
    const items: MenuAction[] = [];
    const isFatigued = m.fatigueLevel > 0.5;

    if (m.assignedRole === 'compressor') {
      items.push({ label: isFatigued ? '⚠ Rotate Compressor' : 'Rotate Compressor',
        variant: isFatigued ? 'red' : 'gray',
        onSelect: () => act(actions.switchCompressor) });
    }
    if (openOrder) {
      items.push({ label: `CLC: "${openOrder.label.slice(0, 22)}…"`, variant: 'amber',
        onSelect: () => act(() => actions.requestClosedLoop(openOrder.id)) });
    }
    const QUICK: TeamRole[] = ['airway', 'iv_access', 'medication', 'monitor_defib', 'compressor', 'recorder'];
    for (const role of QUICK) {
      if (m.assignedRole !== role) {
        items.push({ label: `→ ${ROLE_FULL[role]}`, variant: 'gray',
          onSelect: () => act(() => actions.assignRole(m.id, role)) });
      }
    }
    if (!m.confirmedRole && m.assignedRole !== 'none') {
      items.push({ label: 'Confirm Role (Closed-Loop)', variant: 'green',
        onSelect: () => act(() => actions.confirmRole(m.id)) });
    }
    return items;
  }

  function openZoneMenu(id: ZoneId, anchorPct: { x: number; y: number }) {
    const titleMap: Record<ZoneId, string> = {
      patient_bed: 'Patient Bed',
      defib_station: 'Monitor / Defib',
      medication_station: 'Medication Cart',
      airway_station: 'Airway Equipment',
      door: 'Team Actions',
    };
    const itemMap: Record<ZoneId, MenuAction[]> = {
      patient_bed: patientMenu(),
      defib_station: defibMenu(),
      medication_station: medicationMenu(),
      airway_station: airwayMenu(),
      door: doorMenu(),
    };
    setMenu({ targetId: id, title: titleMap[id], items: itemMap[id], anchor: anchorPct });
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gray-950 overflow-hidden select-none"
      onClick={() => setMenu(null)}
    >
      {/* ── Isometric room SVG ── */}
      <svg
        viewBox={`0 0 ${ROOM_W} ${ROOM_H}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <filter id="iso-glow-amber">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="iso-glow-blue">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <pattern id="floor-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f2937" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width={ROOM_W} height={ROOM_H} fill="#060a14" />
        <rect x="0" y="0" width={ROOM_W} height={ROOM_H} fill="url(#floor-grid)" opacity="0.4" />

        {/* Room outline — large isometric floor */}
        <polygon
          points={isoFloor(500, 340, 940, 470)}
          fill="#0a0f1a"
          stroke="#1e293b"
          strokeWidth="1"
        />

        {/* Render zones back-to-front (painter's algorithm) */}
        {ZONES.map(z => {
          const isCprBed = z.id === 'patient_bed' && ui.cprActive;
          const isCharged = z.id === 'defib_station' && ui.defibCharged;
          const isShockableZone = z.id === 'defib_station' && isShockable;
          const strokeColor = isCharged ? '#fbbf24' : isShockableZone ? '#f97316' : z.topStroke;
          const strokeW = isCharged || isCprBed ? 2.5 : 1.5;

          return (
            <g key={z.id}>
              {/* Left face */}
              <polygon
                points={isoLeftFace(z.cx, z.cy, z.w, z.h, z.fh)}
                fill={z.leftFill}
                stroke={z.topStroke + '40'}
                strokeWidth="0.5"
              />
              {/* Right face */}
              <polygon
                points={isoRightFace(z.cx, z.cy, z.w, z.h, z.fh)}
                fill={z.rightFill}
                stroke={z.topStroke + '40'}
                strokeWidth="0.5"
              />
              {/* Top face */}
              <polygon
                points={isoFloor(z.cx, z.cy, z.w, z.h)}
                fill={z.topFill}
                stroke={strokeColor}
                strokeWidth={strokeW}
                filter={isCharged ? 'url(#iso-glow-amber)' : isCprBed ? 'url(#iso-glow-blue)' : undefined}
              />
              {/* Zone label */}
              <text
                x={z.cx}
                y={z.cy + 4}
                textAnchor="middle"
                fontSize={z.id === 'patient_bed' ? 13 : 10}
                fontWeight="bold"
                fill={z.labelColor}
                fontFamily="monospace"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {z.id === 'patient_bed'
                  ? (ui.cprActive ? 'CPR IN PROGRESS' : !isArrest ? 'ROSC' : 'PATIENT')
                  : z.id === 'defib_station' && isCharged
                    ? '⚡ 200J READY'
                    : z.id === 'airway_station' && ui.hasAdvancedAirway
                      ? 'AIRWAY ✓'
                      : z.label}
              </text>
            </g>
          );
        })}

        {/* CPR pulse ring (SVG layer) */}
        {ui.cprActive && (
          <motion.circle
            cx={500} cy={320} r={50}
            fill="none"
            stroke="#ef4444"
            strokeWidth={2}
            animate={{ r: [45, 70, 45], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
      </svg>

      {/* ── Clickable zone overlays (invisible hit targets) ── */}
      {ZONES.map(z => {
        const pct = zoneToPct(z.cx, z.cy);
        return (
          <div
            key={z.id}
            className="absolute cursor-pointer"
            style={{
              left: `${pct.x - 8}%`,
              top: `${pct.y - 6}%`,
              width: `${(z.w / ROOM_W) * 100 * 1.1}%`,
              height: `${(z.h / ROOM_H) * 100 * 1.2}%`,
              zIndex: 5,
            }}
            onClick={e => { e.stopPropagation(); openZoneMenu(z.id, { x: pct.x - 2, y: pct.y - 10 }); }}
            title={`Click: ${z.label}`}
          />
        );
      })}

      {/* ── Staff avatars ── */}
      {ui.team.map(m => {
        const pos = ROLE_POSITIONS[m.assignedRole] ?? ROLE_POSITIONS.none;
        const isFatigued = m.fatigueLevel > 0.5;
        const isCpr = m.assignedRole === 'compressor' && ui.cprActive;
        const hasSpeech = !!m.speech && ui.clock < m.speech.until;

        return (
          <div
            key={m.id}
            className="absolute"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)', zIndex: 20 }}
          >
            {/* Speech bubble */}
            <AnimatePresence>
              {hasSpeech && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                >
                  <div className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-[8px] text-gray-200 whitespace-nowrap max-w-[120px] truncate shadow-lg">
                    {m.speech!.text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-gray-600" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Avatar circle */}
            <motion.button
              onClick={e => {
                e.stopPropagation();
                setMenu({
                  targetId: m.id,
                  title: `${m.name} (${ROLE_SHORT[m.assignedRole]})`,
                  items: memberMenu(m),
                  anchor: { x: clamp(pos.x + 5, 5, 72), y: clamp(pos.y + 5, 5, 65) },
                });
              }}
              whileHover={{ scale: 1.18 }}
              animate={
                isCpr
                  ? { y: [0, -4, 0], scale: [1, 1.08, 1] }
                  : isFatigued
                    ? { scale: [1, 1.05, 1] }
                    : {}
              }
              transition={{
                duration: isCpr ? 0.55 : 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-bold border-2 cursor-pointer shadow-lg ${
                m.isLeader
                  ? 'bg-amber-700 border-amber-300 text-amber-50'
                  : isFatigued
                    ? 'bg-red-900 border-red-400 text-red-100'
                    : m.confirmedRole
                      ? 'bg-green-900 border-green-500 text-green-100'
                      : 'bg-gray-800 border-gray-500 text-gray-300'
              }`}
              title={`${m.name} — ${ROLE_FULL[m.assignedRole]}`}
            >
              {m.name.split(' ')[0].slice(0, 3)}
            </motion.button>

            {/* Role label */}
            <div className="text-center mt-0.5 pointer-events-none">
              <div className="text-[8px] text-gray-400 leading-none">
                {ROLE_SHORT[m.assignedRole]}{isFatigued ? ' ⚠' : ''}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Context menu ── */}
      <AnimatePresence>
        {menu && (
          <>
            <div className="absolute inset-0 z-40" onClick={close} />
            <motion.div
              className="absolute z-50 bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-1.5 min-w-[160px] max-w-[210px]"
              style={anchorStyle(menu.anchor)}
              initial={{ opacity: 0, scale: 0.88, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: -4 }}
              transition={{ duration: 0.1 }}
            >
              <div className="text-[9px] text-gray-400 font-semibold px-1.5 pb-1 border-b border-gray-700 mb-1 truncate">
                {menu.title}
              </div>
              {menu.items.length === 0 && (
                <div className="text-[9px] text-gray-600 px-1.5 py-1">No actions available</div>
              )}
              {menu.items.map((item, i) => (
                <button
                  key={i}
                  onClick={item.disabled ? undefined : item.onSelect}
                  disabled={item.disabled}
                  className={`w-full text-left text-[10px] px-2 py-1 rounded mb-0.5 ${menuItemCls(item.variant, item.disabled)}`}
                >
                  <div>{item.label}</div>
                  {item.sublabel && (
                    <div className="text-[8px] opacity-60 mt-0.5">{item.sublabel}</div>
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Chaos meter bar ── */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-0.5" style={{ width: 200 }}>
        <div className="flex items-center justify-between w-full px-0.5">
          <span className="text-[9px] text-gray-600 tracking-widest">CHAOS</span>
          <span className="text-[9px] text-gray-600">{ui.chaosFiredCount} events</span>
        </div>
        <div className="w-full h-2 bg-gray-900 border border-gray-800 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              chaosRatio > 0.7 ? 'bg-red-500' : chaosRatio > 0.4 ? 'bg-amber-500' : 'bg-green-600'
            }`}
            animate={{ width: `${Math.max(2, chaosRatio * 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* ── Hint text ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <span className="text-[8px] text-gray-700 tracking-wide">
          Click patient · defib · meds · airway · door · any person
        </span>
      </div>
    </div>
  );
}

/* ── Utility: map SVG coordinates to % of container ── */
function zoneToPct(cx: number, cy: number): { x: number; y: number } {
  return {
    x: (cx / ROOM_W) * 100,
    y: (cy / ROOM_H) * 100,
  };
}
