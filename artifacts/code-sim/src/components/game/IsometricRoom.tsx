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

/* ── Isometric furniture helpers ──────────────────────────────────── */

/** A thin "slab" top face — handy for rails, shelves, table-tops */
function isoSlab(cx: number, cy: number, w: number, h: number): string {
  return isoFloor(cx, cy, w, h);
}

/** Vertical wall / panel face oriented on the left side */
function isoPanel(cx: number, cy: number, w: number, h: number, fh: number) {
  return {
    top:   isoFloor(cx, cy, w, h),
    left:  isoLeftFace(cx, cy, w, h, fh),
    right: isoRightFace(cx, cy, w, h, fh),
  };
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

const ROLE_BADGE_CLS: Record<TeamRole, string> = {
  leader:        'bg-amber-800/80 border-amber-400 text-amber-100',
  compressor:    'bg-red-800/80 border-red-400 text-red-100',
  airway:        'bg-amber-900/80 border-amber-500 text-amber-200',
  iv_access:     'bg-blue-900/80 border-blue-400 text-blue-200',
  medication:    'bg-green-900/80 border-green-500 text-green-200',
  monitor_defib: 'bg-violet-900/80 border-violet-500 text-violet-200',
  recorder:      'bg-gray-800/80 border-gray-500 text-gray-300',
  timekeeper:    'bg-gray-800/80 border-gray-500 text-gray-300',
  none:          'bg-gray-900/60 border-gray-700 text-gray-600',
};

function fatigueHaloColor(fatigue: number): string {
  if (fatigue < 0.35) return '#22c55e';
  if (fatigue < 0.65) return '#f59e0b';
  return '#ef4444';
}

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

/* ── Zone furniture SVG ───────────────────────────────────────────── */

interface FurnitureProps { zone: RoomZone }

function PatientBedFurniture({ zone, cprActive }: FurnitureProps & { cprActive: boolean }) {
  const { cx, cy } = zone;
  // Mattress surface (inset)
  const mattW = 195, mattH = 96;
  // Head-board: thin box at top of diamond (toward upper iso point)
  const headCy = cy - zone.h / 2 + 14; // near top diamond point
  const headW = 145, headH = 16, headFh = 11;
  // Foot-board: thinner box near bottom diamond point
  const footCy = cy + zone.h / 2 - 12;
  const footW = 120, footH = 13, footFh = 8;
  // Pillow: tiny diamond just south of head board
  const pillowCy = headCy + 22;

  const mattFill   = cprActive ? '#1a3a6a' : '#1a3560';
  const railFill   = '#0e2040';
  const railTop    = '#2563eb';
  const railStroke = '#3b82f680';

  return (
    <g opacity="0.92">
      {/* Mattress */}
      <polygon points={isoSlab(cx, cy, mattW, mattH)}
        fill={mattFill} stroke="#3b82f650" strokeWidth="1" />

      {/* Head board */}
      <polygon points={isoLeftFace(cx, headCy, headW, headH, headFh)}
        fill={railFill} stroke={railStroke} strokeWidth="0.5" />
      <polygon points={isoRightFace(cx, headCy, headW, headH, headFh)}
        fill="#0a1830" stroke={railStroke} strokeWidth="0.5" />
      <polygon points={isoSlab(cx, headCy, headW, headH)}
        fill={railTop} stroke="#60a5fa" strokeWidth="1" />

      {/* Pillow */}
      <polygon points={isoSlab(cx, pillowCy, 55, 26)}
        fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" opacity="0.55" />

      {/* Left bed rail (line along left edge of mattress) */}
      <line
        x1={cx - mattW / 2} y1={cy}
        x2={cx}              y2={cy - mattH / 2}
        stroke="#1d4ed8" strokeWidth="1.2" opacity="0.6" />
      {/* Right bed rail */}
      <line
        x1={cx + mattW / 2} y1={cy}
        x2={cx}              y2={cy - mattH / 2}
        stroke="#1d4ed8" strokeWidth="1.2" opacity="0.6" />

      {/* Foot board */}
      <polygon points={isoLeftFace(cx, footCy, footW, footH, footFh)}
        fill={railFill} stroke={railStroke} strokeWidth="0.5" />
      <polygon points={isoRightFace(cx, footCy, footW, footH, footFh)}
        fill="#0a1830" stroke={railStroke} strokeWidth="0.5" />
      <polygon points={isoSlab(cx, footCy, footW, footH)}
        fill={railTop} stroke="#60a5fa" strokeWidth="1" />
    </g>
  );
}

function DefibFurniture({ zone, charged }: FurnitureProps & { charged: boolean }) {
  const { cx, cy } = zone;
  // Main defibrillator cart body — sits right-of-centre on the tile
  const boxCx = cx + 18, boxCy = cy - 8;
  const bW = 70, bH = 36, bFh = 30;
  const screenColor = charged ? '#fbbf24' : '#22d3ee';

  // Screen rectangle within the right face of the monitor
  // Right face corners: (cx+w/2,cy), (cx,cy+h/2), (cx,cy+h/2+fh), (cx+w/2,cy+fh)
  const rfTL = { x: boxCx + bW / 2,           y: boxCy };
  const rfBL = { x: boxCx,                     y: boxCy + bH / 2 };
  const rfBR = { x: boxCx,                     y: boxCy + bH / 2 + bFh };
  const rfTR = { x: boxCx + bW / 2,            y: boxCy + bFh };
  // Screen inset (70% of face)
  const sw = 0.65, sh = 0.6, ox = 0.15, oy = 0.2;
  function lerp2(a: {x:number,y:number}, b: {x:number,y:number}, t: number) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  const scrTL = lerp2(lerp2(rfTL, rfBL, oy),         lerp2(rfTR, rfBR, oy),         ox);
  const scrTR = lerp2(lerp2(rfTL, rfBL, oy),         lerp2(rfTR, rfBR, oy),         ox + sw);
  const scrBL = lerp2(lerp2(rfTL, rfBL, oy + sh),    lerp2(rfTR, rfBR, oy + sh),    ox);
  const scrBR = lerp2(lerp2(rfTL, rfBL, oy + sh),    lerp2(rfTR, rfBR, oy + sh),    ox + sw);

  return (
    <g opacity="0.93">
      <polygon points={isoLeftFace(boxCx, boxCy, bW, bH, bFh)}
        fill="#1a0808" stroke="#ef444440" strokeWidth="0.5" />
      <polygon points={isoRightFace(boxCx, boxCy, bW, bH, bFh)}
        fill="#250d0d" stroke="#ef444440" strokeWidth="0.5" />
      <polygon points={isoSlab(boxCx, boxCy, bW, bH)}
        fill="#3b1212" stroke="#ef4444" strokeWidth="1" />
      {/* Monitor screen */}
      <polygon
        points={`${scrTL.x},${scrTL.y} ${scrTR.x},${scrTR.y} ${scrBR.x},${scrBR.y} ${scrBL.x},${scrBL.y}`}
        fill={charged ? '#78350f' : '#0c2a2e'}
        stroke={screenColor}
        strokeWidth="1"
        opacity="0.9"
      />
      {/* Screen glow line (EKG trace) */}
      <line
        x1={(scrTL.x + scrBL.x) / 2} y1={(scrTL.y + scrBL.y) / 2}
        x2={(scrTR.x + scrBR.x) / 2} y2={(scrTR.y + scrBR.y) / 2}
        stroke={screenColor} strokeWidth="1" opacity="0.7"
      />
      {/* Paddles on top */}
      <line x1={boxCx - 4} y1={boxCy - bH / 2 + 2} x2={boxCx - 18} y2={boxCy - bH / 2 - 5}
        stroke="#9ca3af" strokeWidth="1.5" />
      <line x1={boxCx + 10} y1={boxCy - bH / 2 + 4} x2={boxCx + 22} y2={boxCy - bH / 2 - 4}
        stroke="#9ca3af" strokeWidth="1.5" />
    </g>
  );
}

function MedCartFurniture({ zone }: FurnitureProps) {
  const { cx, cy } = zone;
  const boxCx = cx - 8, boxCy = cy - 6;
  const bW = 65, bH = 35, bFh = 26;

  return (
    <g opacity="0.9">
      <polygon points={isoLeftFace(boxCx, boxCy, bW, bH, bFh)}
        fill="#0a180a" stroke="#22c55e40" strokeWidth="0.5" />
      <polygon points={isoRightFace(boxCx, boxCy, bW, bH, bFh)}
        fill="#0e1e0e" stroke="#22c55e40" strokeWidth="0.5" />
      <polygon points={isoSlab(boxCx, boxCy, bW, bH)}
        fill="#1a3a1a" stroke="#22c55e" strokeWidth="1" />
      {/* Drawer divider lines on left face */}
      {[0.35, 0.65].map((t, i) => {
        const lf = isoLeftFace(boxCx, boxCy, bW, bH, bFh).split(' ').map(p => ({ x: +p.split(',')[0], y: +p.split(',')[1] }));
        const y1 = lf[0].y + (lf[1].y - lf[0].y) * t + (lf[3].y - lf[0].y) * 0;
        const x1 = lf[0].x + (lf[1].x - lf[0].x) * t;
        const y2 = lf[3].y + (lf[2].y - lf[3].y) * t;
        const x2 = lf[3].x + (lf[2].x - lf[3].x) * t;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#22c55e50" strokeWidth="0.8" />;
      })}
      {/* IV bag/bottle silhouette on top */}
      <ellipse cx={boxCx + 5} cy={boxCy - bH / 2 - 2} rx={7} ry={4}
        fill="#052e16" stroke="#4ade80" strokeWidth="0.8" opacity="0.85" />
      {/* Drip line */}
      <line x1={boxCx + 5} y1={boxCy - bH / 2 + 2} x2={boxCx + 5} y2={boxCy - bH / 2 + 10}
        stroke="#4ade80" strokeWidth="0.6" opacity="0.6" />
    </g>
  );
}

function AirwayCartFurniture({ zone, hasAdvanced }: FurnitureProps & { hasAdvanced: boolean }) {
  const { cx, cy } = zone;
  const boxCx = cx + 5, boxCy = cy - 4;
  const bW = 72, bH = 40, bFh = 22;
  // IV / airway pole — sits to the right of the cart
  const poleCx = cx + 55, poleCy = cy;

  return (
    <g opacity="0.93">
      {/* Cart body */}
      <polygon points={isoLeftFace(boxCx, boxCy, bW, bH, bFh)}
        fill="#1a1404" stroke="#f59e0b40" strokeWidth="0.5" />
      <polygon points={isoRightFace(boxCx, boxCy, bW, bH, bFh)}
        fill="#211a05" stroke="#f59e0b40" strokeWidth="0.5" />
      <polygon points={isoSlab(boxCx, boxCy, bW, bH)}
        fill="#2d2206" stroke="#f59e0b" strokeWidth="1" />
      {/* Drawer dividers on right face */}
      {[0.4, 0.72].map((t, i) => {
        const lf = isoRightFace(boxCx, boxCy, bW, bH, bFh).split(' ').map(p => ({ x: +p.split(',')[0], y: +p.split(',')[1] }));
        const x1 = lf[0].x + (lf[1].x - lf[0].x) * t;
        const y1 = lf[0].y + (lf[1].y - lf[0].y) * t;
        const x2 = lf[3].x + (lf[2].x - lf[3].x) * t;
        const y2 = lf[3].y + (lf[2].y - lf[3].y) * t;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f59e0b50" strokeWidth="0.8" />;
      })}
      {/* Tubes / BVM bag on top */}
      <ellipse cx={boxCx - 6} cy={boxCy - bH / 2 - 3} rx={10} ry={5}
        fill="#1c1003" stroke="#fcd34d" strokeWidth="0.9" opacity="0.9" />
      <line x1={boxCx - 6} y1={boxCy - bH / 2 + 2} x2={boxCx + 10} y2={boxCy - bH / 2 + 8}
        stroke="#fcd34d" strokeWidth="0.7" opacity="0.55" />

      {/* Airway pole (IV stand) */}
      <line x1={poleCx} y1={poleCy - bH / 2 - 2} x2={poleCx} y2={poleCy - bH / 2 - 28}
        stroke={hasAdvanced ? '#4ade80' : '#6b7280'} strokeWidth="1.5" />
      {/* Hook / cross-bar at top */}
      <line x1={poleCx - 7} y1={poleCy - bH / 2 - 26} x2={poleCx + 7} y2={poleCy - bH / 2 - 26}
        stroke={hasAdvanced ? '#4ade80' : '#6b7280'} strokeWidth="1.5" />
      {/* IV bag on pole */}
      <ellipse cx={poleCx} cy={poleCy - bH / 2 - 28} rx={5} ry={3}
        fill={hasAdvanced ? '#052e16' : '#111827'}
        stroke={hasAdvanced ? '#4ade80' : '#374151'} strokeWidth="0.8" opacity="0.9" />
    </g>
  );
}

function DoorFurniture({ zone }: FurnitureProps) {
  const { cx, cy, w, h } = zone;
  // The door tile diamond: top=(cx,cy-h/2), right=(cx+w/2,cy), bottom=(cx,cy+h/2), left=(cx-w/2,cy)
  // Draw a door arch rising from the tile's top face
  const topY = cy - h / 2; // top diamond point y
  const archH = 32;        // how high the arch rises above the tile

  // Left pillar of door frame (left side of top diamond point)
  const lx1 = cx - 18, lx2 = cx - 18;
  const rx1 = cx + 18, rx2 = cx + 18;
  const baseY = topY + 4;
  const archTopY = topY - archH;

  return (
    <g opacity="0.85">
      {/* Left door pillar */}
      <line x1={lx1} y1={baseY} x2={lx2} y2={archTopY + 8}
        stroke="#6b7280" strokeWidth="2.5" />
      {/* Right door pillar */}
      <line x1={rx1} y1={baseY} x2={rx2} y2={archTopY + 8}
        stroke="#6b7280" strokeWidth="2.5" />
      {/* Arch (semicircle) */}
      <path
        d={`M ${lx1} ${archTopY + 8} Q ${cx} ${archTopY - 6} ${rx1} ${archTopY + 8}`}
        fill="none" stroke="#6b7280" strokeWidth="2.5"
      />
      {/* Door panel fill */}
      <path
        d={`M ${lx1 + 2} ${baseY} L ${lx1 + 2} ${archTopY + 9} Q ${cx} ${archTopY - 4} ${rx1 - 2} ${archTopY + 9} L ${rx1 - 2} ${baseY} Z`}
        fill="#111827" stroke="none" opacity="0.7"
      />
      {/* Door handle dot */}
      <circle cx={cx + 10} cy={(baseY + archTopY) / 2 + 4} r={2.5}
        fill="#9ca3af" opacity="0.85" />
      {/* Lintel (top bar) */}
      <line x1={lx1 - 3} y1={archTopY + 8} x2={rx1 + 3} y2={archTopY + 8}
        stroke="#4b5563" strokeWidth="1" />
    </g>
  );
}

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
              {/* Zone furniture */}
              {z.id === 'patient_bed' && (
                <PatientBedFurniture zone={z} cprActive={ui.cprActive} />
              )}
              {z.id === 'defib_station' && (
                <DefibFurniture zone={z} charged={ui.defibCharged} />
              )}
              {z.id === 'medication_station' && (
                <MedCartFurniture zone={z} />
              )}
              {z.id === 'airway_station' && (
                <AirwayCartFurniture zone={z} hasAdvanced={ui.hasAdvancedAirway} />
              )}
              {z.id === 'door' && (
                <DoorFurniture zone={z} />
              )}

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

            {/* Fatigue halo — compressor only */}
            {m.assignedRole === 'compressor' && (
              <motion.div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  boxShadow: `0 0 0 3px ${fatigueHaloColor(m.fatigueLevel)}, 0 0 10px 3px ${fatigueHaloColor(m.fatigueLevel)}88`,
                }}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

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

            {/* Role badge — always visible */}
            {m.assignedRole !== 'none' && (
              <div className="text-center mt-0.5 pointer-events-none">
                <span className={`inline-flex items-center gap-0.5 px-1 py-px rounded border text-[7px] font-bold leading-none ${ROLE_BADGE_CLS[m.assignedRole]}`}>
                  {m.confirmedRole && (
                    <span className="text-[7px] leading-none">✓</span>
                  )}
                  {ROLE_SHORT[m.assignedRole]}
                </span>
              </div>
            )}
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
