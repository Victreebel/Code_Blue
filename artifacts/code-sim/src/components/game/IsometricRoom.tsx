import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UIState } from '../../engine/ui/uiStateEngine';
import type { EngineActions } from '../../engine/useGameEngine';
import type { TeamMemberRuntime } from '../../engine/types/team';
import type { TeamRole } from '../../engine/types/core';
import { AMIODARONE_FIRST_DOSE_MG, AMIODARONE_SUBSEQUENT_DOSE_MG } from '../../engine/clinical/aclsConstants';
import { useUserPreferences } from '../../hooks/useUserPreferences';

const ROOM_W = 1000;
const ROOM_H = 580;
const VIEW_MIN_Y = 60;
const VIEW_H = 430;

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
  airway:        { x: 50, y:  5 },
  monitor_defib: { x: 79, y: 28 },
  medication:    { x: 22, y: 27 },
  iv_access:     { x: 30, y: 44 },
  compressor:    { x: 67, y: 46 },
  leader:        { x: 64, y: 60 },
  recorder:      { x: 16, y: 10 },
  timekeeper:    { x: 18, y: 74 },
  none:          { x: 88, y: 83 },
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

const ROLE_DOT_COLOR: Record<string, string> = {
  leader:        '#fbbf24',
  compressor:    '#f87171',
  airway:        '#f59e0b',
  iv_access:     '#60a5fa',
  medication:    '#22c55e',
  monitor_defib: '#a78bfa',
  recorder:      '#9ca3af',
  timekeeper:    '#9ca3af',
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

/** Semi-transparent ellipse shadow on the floor plane under an iso box */
function IsoFloorShadow({ cx, cy, w, h, fh, color = '#000' }: {
  cx: number; cy: number; w: number; h: number; fh: number; color?: string;
}) {
  const shadowCy = cy + fh + h * 0.1;
  return (
    <ellipse
      cx={cx} cy={shadowCy}
      rx={w * 0.42} ry={(h + fh) * 0.18}
      fill={color} opacity="0.28"
    />
  );
}

/** Small isometric caster wheel drawn at the base corner of a cart */
function IsoCaster({ x, y, color = '#1f2937' }: { x: number; y: number; color?: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={3.2} ry={2.0} fill={color} stroke="#374151" strokeWidth="0.6" opacity="0.92" />
      <ellipse cx={x} cy={y} rx={1.4} ry={0.9} fill="#111827" opacity="0.7" />
    </g>
  );
}

/** Small bed leg nub at the base corner of the bed frame */
function BedLegNub({ x, y }: { x: number; y: number }) {
  return (
    <rect
      x={x - 3} y={y - 2} width={6} height={4}
      rx={1}
      fill="#0b1d3a" stroke="#1d4ed8" strokeWidth="0.7" opacity="0.9"
    />
  );
}

function PatientBedFurniture({ zone, cprActive }: FurnitureProps & { cprActive: boolean }) {
  const { cx, cy } = zone;

  // Bed frame: elongated ~2:1 footprint, full-length side rails as extruded walls
  const bW = 238, bH = 116, railFh = 16;

  const mattFill   = cprActive ? '#1a3a6a' : '#1a3560';
  const railFill   = '#0b1d3a';
  const railFillR  = '#081526';
  const railTop    = '#2563eb';
  const railStroke = '#3b82f680';

  // Head board: near top diamond point, elevated ~8 units (lower cy = higher visually)
  const headCy = cy - bH / 2 + 6;
  const headW = 148, headH = 14, headFh = 18;

  // Foot board: near bottom diamond point
  const footCy = cy + bH / 2 - 8;
  const footW = 116, footH = 12, footFh = 11;

  // Pillow: small diamond just south of head board
  const pillowCy = headCy + 22;

  // IV pole: rises from left side of head end
  const poleX  = cx - bW / 4 + 4;
  const poleY0 = cy - bH / 2 + 2;   // base of pole (sits on mattress level)
  const poleY1 = poleY0 - 36;        // top of pole

  // Bed leg nub positions: 4 bottom corners of the base box
  // Left face: bottom-left=(cx-bW/2, cy+railFh), bottom-right=(cx, cy+bH/2+railFh)
  // Right face: bottom-left=(cx, cy+bH/2+railFh), bottom-right=(cx+bW/2, cy+railFh)
  const legNubs = [
    { x: cx - bW / 2 + 4, y: cy + railFh },
    { x: cx - 4,           y: cy + bH / 2 + railFh },
    { x: cx + 4,           y: cy + bH / 2 + railFh },
    { x: cx + bW / 2 - 4,  y: cy + railFh },
  ];

  return (
    <g opacity="0.93">
      {/* Floor shadow */}
      <IsoFloorShadow cx={cx} cy={cy} w={bW} h={bH} fh={railFh} color="#1e3a5f" />

      {/* Full-length side rails — drawn as proper extruded wall faces */}
      <polygon points={isoLeftFace(cx, cy, bW, bH, railFh)}
        fill={railFill} stroke={railStroke} strokeWidth="0.8" />
      <polygon points={isoRightFace(cx, cy, bW, bH, railFh)}
        fill={railFillR} stroke={railStroke} strokeWidth="0.8" />

      {/* Mattress surface */}
      <polygon points={isoSlab(cx, cy, bW, bH)}
        fill={mattFill} stroke="#3b82f660" strokeWidth="1.2" />

      {/* Rail cap lines along top edges for visual depth */}
      <line x1={cx - bW / 2} y1={cy} x2={cx} y2={cy - bH / 2}
        stroke="#1d4ed8" strokeWidth="1.8" opacity="0.7" />
      <line x1={cx + bW / 2} y1={cy} x2={cx} y2={cy - bH / 2}
        stroke="#1d4ed8" strokeWidth="1.8" opacity="0.7" />

      {/* Head board */}
      <polygon points={isoLeftFace(cx, headCy, headW, headH, headFh)}
        fill={railFill} stroke={railStroke} strokeWidth="0.5" />
      <polygon points={isoRightFace(cx, headCy, headW, headH, headFh)}
        fill={railFillR} stroke={railStroke} strokeWidth="0.5" />
      <polygon points={isoSlab(cx, headCy, headW, headH)}
        fill={railTop} stroke="#60a5fa" strokeWidth="1.2" />

      {/* Pillow */}
      <polygon points={isoSlab(cx + 6, pillowCy, 54, 24)}
        fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" opacity="0.5" />

      {/* Foot board */}
      <polygon points={isoLeftFace(cx, footCy, footW, footH, footFh)}
        fill={railFill} stroke={railStroke} strokeWidth="0.5" />
      <polygon points={isoRightFace(cx, footCy, footW, footH, footFh)}
        fill={railFillR} stroke={railStroke} strokeWidth="0.5" />
      <polygon points={isoSlab(cx, footCy, footW, footH)}
        fill={railTop} stroke="#60a5fa" strokeWidth="1" />

      {/* IV pole — vertical line at head end */}
      <line x1={poleX} y1={poleY0} x2={poleX} y2={poleY1}
        stroke="#9ca3af" strokeWidth="2" />
      {/* Cross-bar */}
      <line x1={poleX - 9} y1={poleY1 + 3} x2={poleX + 9} y2={poleY1 + 3}
        stroke="#9ca3af" strokeWidth="1.8" />
      {/* IV bag hanging on pole */}
      <ellipse cx={poleX} cy={poleY1 + 1} rx={5} ry={3}
        fill="#0f172a" stroke="#60a5fa" strokeWidth="0.9" opacity="0.85" />
      {/* Drip line from bag to patient */}
      <line x1={poleX} y1={poleY1 + 4} x2={poleX} y2={poleY0 - 2}
        stroke="#60a5fa" strokeWidth="0.6" opacity="0.45" />

      {/* Bed leg foot-cap nubs at base corners */}
      {legNubs.map((n, i) => <BedLegNub key={i} x={n.x} y={n.y} />)}
    </g>
  );
}

function DefibFurniture({ zone, charged }: FurnitureProps & { charged: boolean }) {
  const { cx, cy } = zone;
  const screenColor = charged ? '#fbbf24' : '#22d3ee';

  // ── Low wheeled cart base (wide, shallow) ──────────────────────────
  const baseCx = cx + 6, baseCy = cy + 4;
  const baseW = 78, baseH = 44, baseFh = 10;

  // ── Portrait-oriented monitor unit sitting on the cart ─────────────
  // Narrower footprint, taller face — "portrait" silhouette
  const monCx = cx + 6, monCy = cy - 10;
  const monW = 44, monH = 24, monFh = 50;

  // Right face of monitor: A→B→C→D
  // A=(monCx+monW/2, monCy), B=(monCx, monCy+monH/2),
  // C=(monCx, monCy+monH/2+monFh), D=(monCx+monW/2, monCy+monFh)
  const rfA = { x: monCx + monW / 2, y: monCy };
  const rfB = { x: monCx,            y: monCy + monH / 2 };
  const rfC = { x: monCx,            y: monCy + monH / 2 + monFh };
  const rfD = { x: monCx + monW / 2, y: monCy + monFh };

  function lerp2(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  // Screen inset: 70% of right face area
  const ox = 0.12, oy = 0.10, sw = 0.76, sh = 0.78;
  const scrTL = lerp2(lerp2(rfA, rfB, oy),      lerp2(rfD, rfC, oy),      ox);
  const scrTR = lerp2(lerp2(rfA, rfB, oy),      lerp2(rfD, rfC, oy),      ox + sw);
  const scrBL = lerp2(lerp2(rfA, rfB, oy + sh), lerp2(rfD, rfC, oy + sh), ox);
  const scrBR = lerp2(lerp2(rfA, rfB, oy + sh), lerp2(rfD, rfC, oy + sh), ox + sw);

  // SHOCK button dot on right face (lower-left area)
  const shockBtn = lerp2(lerp2(rfA, rfB, 0.88), lerp2(rfD, rfC, 0.88), 0.35);

  // Paddle holster stubs: short lines projecting from sides of monitor top
  const monTopLeft  = { x: monCx - monW / 2, y: monCy };
  const monTopRight = { x: monCx + monW / 2, y: monCy };

  // Caster positions: 3 visible bottom corners of the cart base
  // Left face bottom: (baseCx-baseW/2, baseCy+baseFh) and (baseCx, baseCy+baseH/2+baseFh)
  // Right face bottom: (baseCx+baseW/2, baseCy+baseFh) and same bottom-most point
  const defibCasters = [
    { x: baseCx - baseW / 2 + 3, y: baseCy + baseFh },
    { x: baseCx,                  y: baseCy + baseH / 2 + baseFh },
    { x: baseCx + baseW / 2 - 3,  y: baseCy + baseFh },
  ];

  return (
    <g opacity="0.93">
      {/* Floor shadow */}
      <IsoFloorShadow cx={baseCx} cy={baseCy} w={baseW} h={baseH} fh={baseFh} color="#3b0808" />

      {/* Cart base — wide, low, wheeled platform */}
      <polygon points={isoLeftFace(baseCx, baseCy, baseW, baseH, baseFh)}
        fill="#1a0505" stroke="#ef444430" strokeWidth="0.5" />
      <polygon points={isoRightFace(baseCx, baseCy, baseW, baseH, baseFh)}
        fill="#220808" stroke="#ef444430" strokeWidth="0.5" />
      <polygon points={isoSlab(baseCx, baseCy, baseW, baseH)}
        fill="#2a0e0e" stroke="#ef444450" strokeWidth="0.8" />

      {/* Monitor unit — portrait box (tall, narrow) */}
      <polygon points={isoLeftFace(monCx, monCy, monW, monH, monFh)}
        fill="#1a0808" stroke="#ef444450" strokeWidth="0.6" />
      <polygon points={isoRightFace(monCx, monCy, monW, monH, monFh)}
        fill="#250d0d" stroke="#ef444450" strokeWidth="0.6" />
      <polygon points={isoSlab(monCx, monCy, monW, monH)}
        fill="#3b1212" stroke="#ef4444" strokeWidth="1.2"
        filter={charged ? 'url(#iso-glow-amber)' : undefined} />

      {/* Monitor screen — fills ~70% of right face */}
      <polygon
        points={`${scrTL.x},${scrTL.y} ${scrTR.x},${scrTR.y} ${scrBR.x},${scrBR.y} ${scrBL.x},${scrBL.y}`}
        fill={charged ? '#78350f' : '#0c2a2e'}
        stroke={screenColor}
        strokeWidth="1.2"
        opacity="0.95"
      />
      {/* EKG trace line across screen */}
      <line
        x1={scrTL.x + (scrBL.x - scrTL.x) * 0.5} y1={scrTL.y + (scrBL.y - scrTL.y) * 0.5}
        x2={scrTR.x + (scrBR.x - scrTR.x) * 0.5} y2={scrTR.y + (scrBR.y - scrTR.y) * 0.5}
        stroke={screenColor} strokeWidth="1" opacity="0.65"
      />

      {/* SHOCK button — prominent red dot on monitor face */}
      <circle cx={shockBtn.x} cy={shockBtn.y} r={3.5}
        fill={charged ? '#ef4444' : '#7f1d1d'} stroke="#fca5a5" strokeWidth="0.8" opacity="0.95" />

      {/* Paddle holster stubs — short lines on left and right of monitor top */}
      <line x1={monTopLeft.x} y1={monTopLeft.y}
            x2={monTopLeft.x - 10} y2={monTopLeft.y - 6}
        stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" />
      <line x1={monTopRight.x} y1={monTopRight.y}
            x2={monTopRight.x + 10} y2={monTopRight.y - 5}
        stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" />
      {/* Paddle heads (small circles at end of holster stubs) */}
      <circle cx={monTopLeft.x - 10} cy={monTopLeft.y - 6} r={3}
        fill="#374151" stroke="#6b7280" strokeWidth="0.8" />
      <circle cx={monTopRight.x + 10} cy={monTopRight.y - 5} r={3}
        fill="#374151" stroke="#6b7280" strokeWidth="0.8" />

      {/* Wheel casters at base corners of cart */}
      {defibCasters.map((c, i) => <IsoCaster key={i} x={c.x} y={c.y} color="#2d0a0a" />)}
    </g>
  );
}

function MedCartFurniture({ zone }: FurnitureProps) {
  const { cx, cy } = zone;
  // Crash cart: narrow footprint, tall tower body
  const boxCx = cx - 6, boxCy = cy - 4;
  const bW = 50, bH = 26, bFh = 50;

  // Left face corner points for drawer geometry
  // TL=(boxCx-bW/2, boxCy), TR=(boxCx, boxCy+bH/2)
  // BL=(boxCx-bW/2, boxCy+bFh), BR=(boxCx, boxCy+bH/2+bFh)
  const lfTLx = boxCx - bW / 2, lfTLy = boxCy;
  const lfTRx = boxCx,          lfTRy = boxCy + bH / 2;
  const lfBLx = boxCx - bW / 2, lfBLy = boxCy + bFh;
  const lfBRx = boxCx,          lfBRy = boxCy + bH / 2 + bFh;

  // 4 drawers: dividers at 25%, 50%, 75% of face height
  const divTs = [0.25, 0.50, 0.75];

  // Work surface: thin slab slightly wider than body
  const surfW = bW + 8, surfH = bH + 6;

  // Caster positions: 3 visible bottom corners of the crash cart base
  const medCasters = [
    { x: boxCx - bW / 2 + 2, y: boxCy + bFh },
    { x: boxCx,               y: boxCy + bH / 2 + bFh },
    { x: boxCx + bW / 2 - 2,  y: boxCy + bFh },
  ];

  return (
    <g opacity="0.92">
      {/* Floor shadow */}
      <IsoFloorShadow cx={boxCx} cy={boxCy} w={bW} h={bH} fh={bFh} color="#0a2a0a" />

      {/* Tower body — left and right faces */}
      <polygon points={isoLeftFace(boxCx, boxCy, bW, bH, bFh)}
        fill="#0a180a" stroke="#22c55e40" strokeWidth="0.5" />
      <polygon points={isoRightFace(boxCx, boxCy, bW, bH, bFh)}
        fill="#0e1e0e" stroke="#22c55e40" strokeWidth="0.5" />

      {/* 4 drawer rows — divider lines on left face */}
      {divTs.map((t, i) => {
        const x1 = lfTLx; const y1 = lfTLy + (lfBLy - lfTLy) * t;
        const x2 = lfTRx; const y2 = lfTRy + (lfBRy - lfTRy) * t;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#22c55e60" strokeWidth="1" />;
      })}

      {/* Pull handles — one per drawer, small circles on left face */}
      {[0.125, 0.375, 0.625, 0.875].map((t, i) => {
        // Midpoint of each drawer band, centered horizontally on the face
        const hx = lfTLx + (lfTRx - lfTLx) * 0.5;
        const hy = lfTLy + (lfBLy - lfTLy) * t + (lfTRy - lfTLy) * 0.5;
        return (
          <circle key={i} cx={hx} cy={hy} r={2.4}
            fill="#166534" stroke="#4ade80" strokeWidth="0.8" opacity="0.9" />
        );
      })}

      {/* Work surface top — slightly wider than body */}
      <polygon points={isoSlab(boxCx, boxCy, surfW, surfH)}
        fill="#1a3a1a" stroke="#22c55e" strokeWidth="1.2" />

      {/* Small supply tray outline on work surface */}
      <polygon points={isoSlab(boxCx - 2, boxCy - 2, surfW * 0.5, surfH * 0.55)}
        fill="none" stroke="#4ade8060" strokeWidth="0.8" />

      {/* Wheel casters at base corners */}
      {medCasters.map((c, i) => <IsoCaster key={i} x={c.x} y={c.y} color="#0d1a0d" />)}
    </g>
  );
}

function AirwayCartFurniture({ zone, hasAdvanced }: FurnitureProps & { hasAdvanced: boolean }) {
  const { cx, cy } = zone;

  // Wide, low footprint — distinct from the tall narrow crash cart
  const boxCx = cx, boxCy = cy - 2;
  const bW = 96, bH = 54, bFh = 16;

  // IV / airway pole — sits near right edge of cart
  const poleCx = cx + 52, poleCy = cy - 4;
  const poleColor = hasAdvanced ? '#4ade80' : '#6b7280';

  // BVM bag: two overlapping ellipses on top face, slightly angled
  const bvmCx = boxCx - 16, bvmCy = boxCy - bH / 2 - 4;

  // Suction canister: small box to the right on top
  const canCx = boxCx + 18, canCy = boxCy - bH / 2 - 2;
  const canW = 22, canH = 14, canFh = 8;

  // Caster positions: 3 visible bottom corners of the airway cart base
  const airwayCasters = [
    { x: boxCx - bW / 2 + 4, y: boxCy + bFh },
    { x: boxCx,               y: boxCy + bH / 2 + bFh },
    { x: boxCx + bW / 2 - 4,  y: boxCy + bFh },
  ];

  return (
    <g opacity="0.93">
      {/* Floor shadow */}
      <IsoFloorShadow cx={boxCx} cy={boxCy} w={bW} h={bH} fh={bFh} color="#1a1000" />

      {/* Wide cart body */}
      <polygon points={isoLeftFace(boxCx, boxCy, bW, bH, bFh)}
        fill="#1a1404" stroke="#f59e0b40" strokeWidth="0.5" />
      <polygon points={isoRightFace(boxCx, boxCy, bW, bH, bFh)}
        fill="#211a05" stroke="#f59e0b40" strokeWidth="0.5" />
      <polygon points={isoSlab(boxCx, boxCy, bW, bH)}
        fill="#2d2206" stroke="#f59e0b" strokeWidth="1.1" />

      {/* BVM bag — two overlapping ellipses at a slight angle */}
      <ellipse cx={bvmCx - 5} cy={bvmCy + 2} rx={13} ry={6}
        fill="#1c1003" stroke="#fcd34d" strokeWidth="0.9" opacity="0.85"
        transform={`rotate(-8, ${bvmCx - 5}, ${bvmCy + 2})`} />
      <ellipse cx={bvmCx + 6} cy={bvmCy - 1} rx={11} ry={5}
        fill="#251500" stroke="#fcd34d" strokeWidth="0.9" opacity="0.9"
        transform={`rotate(6, ${bvmCx + 6}, ${bvmCy - 1})`} />
      {/* Connector tube between BVM and airway */}
      <line x1={bvmCx + 12} y1={bvmCy + 1} x2={bvmCx + 22} y2={bvmCy + 5}
        stroke="#fcd34d" strokeWidth="1.1" opacity="0.55" />

      {/* Suction canister — small cylinder/box on top right of cart */}
      <polygon points={isoLeftFace(canCx, canCy, canW, canH, canFh)}
        fill="#120e00" stroke="#f59e0b30" strokeWidth="0.5" />
      <polygon points={isoRightFace(canCx, canCy, canW, canH, canFh)}
        fill="#1a1400" stroke="#f59e0b30" strokeWidth="0.5" />
      <polygon points={isoSlab(canCx, canCy, canW, canH)}
        fill="#292100" stroke="#f59e0b80" strokeWidth="0.8" />
      {/* Canister label line */}
      <line x1={canCx + canW / 2} y1={canCy} x2={canCx} y2={canCy + canH / 2}
        stroke="#f59e0b40" strokeWidth="0.6" />

      {/* Airway / IV pole */}
      <line x1={poleCx} y1={poleCy} x2={poleCx} y2={poleCy - 36}
        stroke={poleColor} strokeWidth="1.8" />
      {/* Cross-bar at top */}
      <line x1={poleCx - 8} y1={poleCy - 34} x2={poleCx + 8} y2={poleCy - 34}
        stroke={poleColor} strokeWidth="1.8" />
      {/* IV bag on pole */}
      <ellipse cx={poleCx} cy={poleCy - 36} rx={5} ry={3}
        fill={hasAdvanced ? '#052e16' : '#111827'}
        stroke={poleColor} strokeWidth="0.9" opacity="0.95" />
      {/* Drip line */}
      <line x1={poleCx} y1={poleCy - 33} x2={poleCx} y2={poleCy - 8}
        stroke={poleColor} strokeWidth="0.6" opacity="0.4" />

      {/* Wheel casters at base corners */}
      {airwayCasters.map((c, i) => <IsoCaster key={i} x={c.x} y={c.y} color="#1a1000" />)}
    </g>
  );
}

function DoorFurniture({ zone }: FurnitureProps) {
  const { cx, cy } = zone;

  // Door frame geometry: flat-top ICU-style door rising above the floor tile
  // Frame dimensions
  const doorW = 38;   // half-width of door opening
  const doorH = 46;   // height of door from base to lintel
  const wallT = 6;    // wall thickness (jamb depth)
  const frameStroke = '#4b5563';

  const baseY  = cy - 4;             // base of door frame
  const topY   = baseY - doorH;      // top of door opening (lintel underside)
  const lx     = cx - doorW;         // left inner edge
  const rx     = cx + doorW;         // right inner edge
  const lxO    = lx - wallT;         // left outer edge (wall jamb)
  const rxO    = rx + wallT;         // right outer edge (wall jamb)

  // Window pane: in the upper third of the door panel
  const winY1  = topY + 4;
  const winY2  = topY + doorH * 0.32;
  const winX1  = cx - doorW * 0.52;
  const winX2  = cx + doorW * 0.52;

  // Lever handle: small angled line + base circle on right side of door
  const handleY = baseY - doorH * 0.45;
  const handleX = cx + doorW * 0.55;

  return (
    <g opacity="0.88">
      {/* Left wall jamb — thin extruded slab (wall thickness) */}
      <rect x={lxO} y={topY} width={wallT} height={doorH}
        fill="#1f2937" stroke={frameStroke} strokeWidth="0.8" />

      {/* Right wall jamb */}
      <rect x={rx} y={topY} width={wallT} height={doorH}
        fill="#1f2937" stroke={frameStroke} strokeWidth="0.8" />

      {/* Lintel slab across the top */}
      <rect x={lxO} y={topY - 5} width={rxO - lxO} height={5}
        fill="#374151" stroke={frameStroke} strokeWidth="0.8" />

      {/* Door panel — dark fill */}
      <rect x={lx} y={topY} width={rx - lx} height={doorH}
        fill="#111827" stroke={frameStroke} strokeWidth="1" opacity="0.88" />

      {/* Window pane — upper third of door */}
      <rect x={winX1} y={winY1} width={winX2 - winX1} height={winY2 - winY1}
        fill="#1e3a5f" stroke="#3b82f6" strokeWidth="0.9" opacity="0.85" />
      {/* Window cross-bars */}
      <line x1={(winX1 + winX2) / 2} y1={winY1} x2={(winX1 + winX2) / 2} y2={winY2}
        stroke="#3b82f640" strokeWidth="0.7" />
      <line x1={winX1} y1={(winY1 + winY2) / 2} x2={winX2} y2={(winY1 + winY2) / 2}
        stroke="#3b82f640" strokeWidth="0.7" />

      {/* Lever handle — angled line from a base circle */}
      <circle cx={handleX} cy={handleY} r={2.2}
        fill="#6b7280" stroke="#9ca3af" strokeWidth="0.7" />
      <line x1={handleX} y1={handleY}
            x2={handleX + 8} y2={handleY + 5}
        stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" />

      {/* Door-stop strip along bottom */}
      <line x1={lx} y1={baseY} x2={rx} y2={baseY}
        stroke="#374151" strokeWidth="1.5" />
    </g>
  );
}

/* ── Floor plan minimap ───────────────────────────────────────────── */

const MAP_X_MIN = 80, MAP_X_MAX = 920;   // isometric X span of the room
const MAP_Y_MIN = 60, MAP_Y_MAX = 530;   // isometric Y span of the room
const MAP_W = 90, MAP_H = 60;            // minimap canvas size (px)

const MINIMAP_ZONE_COLOR: Record<ZoneId, { fill: string; stroke: string }> = {
  airway_station:     { fill: '#78350f',  stroke: '#f59e0b' },
  medication_station: { fill: '#14532d',  stroke: '#22c55e' },
  defib_station:      { fill: '#450a0a',  stroke: '#ef4444' },
  patient_bed:        { fill: '#1e3a5f',  stroke: '#3b82f6' },
  door:               { fill: '#111827',  stroke: '#6b7280' },
};

function zoneToMap(cx: number, cy: number, w: number, h: number) {
  const mx = ((cx - MAP_X_MIN) / (MAP_X_MAX - MAP_X_MIN)) * MAP_W;
  const my = ((cy - MAP_Y_MIN) / (MAP_Y_MAX - MAP_Y_MIN)) * MAP_H;
  const mw = (w / (MAP_X_MAX - MAP_X_MIN)) * MAP_W;
  const mh = (h / (MAP_Y_MAX - MAP_Y_MIN)) * MAP_H;
  return { mx, my, mw, mh };
}

const MINIMAP_ZONE_LABELS: Record<ZoneId, string> = {
  airway_station: 'AIR', medication_station: 'MED', defib_station: 'DEF',
  patient_bed: 'BED', door: 'DR',
};

const MINIMAP_ZONE_FULL_LABEL: Record<ZoneId, string> = {
  airway_station:     'Airway Equipment',
  medication_station: 'Medication Cart',
  defib_station:      'Monitor / Defib',
  patient_bed:        'Patient Bed',
  door:               'Team Actions',
};

const ZONE_HOVER_GLOW: Record<ZoneId, string> = {
  patient_bed:        'rgba(59,130,246,0.7)',
  defib_station:      'rgba(239,68,68,0.7)',
  medication_station: 'rgba(34,197,94,0.7)',
  airway_station:     'rgba(245,158,11,0.7)',
  door:               'rgba(107,114,128,0.5)',
};

const MINIMAP_ZOOM_MIN = 0.75;
const MINIMAP_ZOOM_MAX = 2.0;
const MINIMAP_ZOOM_STEP = 0.25;
const MINIMAP_ZOOM_DEFAULT = 1;
const MINIMAP_ZOOM_KEY = 'acls-minimap-zoom';

interface MinimapProps {
  activeZone: ZoneId | null;
  menuZone: ZoneId | null;
  zoom: number;
  onZoneClick: (id: ZoneId) => void;
  members: TeamMemberRuntime[];
  flashedZones: Set<ZoneId>;
  targetMemberId?: string | null;
}

function FloorPlanMinimap({ activeZone, menuZone, zoom, onZoneClick, members, flashedZones, targetMemberId }: MinimapProps) {
  const assignedMembers = members.filter(m => m.assignedRole !== 'none' && m.inRoom);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoveredMember = hoveredId ? assignedMembers.find(m => m.id === hoveredId) ?? null : null;
  return (
    <svg
      width={MAP_W * zoom}
      height={MAP_H * zoom}
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Room floor */}
      <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#060a14" rx={2} />

      {/* Zones */}
      {ZONES.map(z => {
        const { mx, my, mw, mh } = zoneToMap(z.cx, z.cy, z.w, z.h);
        const col = MINIMAP_ZONE_COLOR[z.id];
        const isActive = activeZone === z.id;
        const isFlashing = flashedZones.has(z.id);
        const isMenuOpen = menuZone === z.id;
        const rx = mx - mw / 2, ry = my - mh / 2;

        return (
          <g
            key={z.id}
            style={{ cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); onZoneClick(z.id); }}
          >
            <title>{MINIMAP_ZONE_FULL_LABEL[z.id]}</title>
            {/* Menu-open glow: wide soft halo behind the zone rect */}
            {isMenuOpen && (
              <rect
                x={rx - 4} y={ry - 4} width={mw + 8} height={mh + 8}
                fill={col.stroke}
                opacity={0.18}
                rx={4}
                style={{ pointerEvents: 'none' }}
              />
            )}
            <rect
              x={rx} y={ry} width={mw} height={mh}
              fill={isMenuOpen ? col.stroke : col.fill}
              stroke={col.stroke}
              strokeWidth={isMenuOpen ? 2.5 : isActive ? 2 : 0.8}
              opacity={isMenuOpen ? 0.35 : isActive ? 1 : 0.75}
              rx={1}
            />
            {/* Menu-open bright border ring */}
            {isMenuOpen && (
              <rect
                x={rx - 1.5} y={ry - 1.5} width={mw + 3} height={mh + 3}
                fill="none"
                stroke={col.stroke}
                strokeWidth={2}
                opacity={0.9}
                rx={2.5}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {isActive && !isMenuOpen && (
              <rect
                x={rx - 1} y={ry - 1} width={mw + 2} height={mh + 2}
                fill="none"
                stroke={col.stroke}
                strokeWidth={1.5}
                opacity={0.5}
                rx={2}
              />
            )}
            {isFlashing && (
              <rect
                x={rx - 1} y={ry - 1} width={mw + 2} height={mh + 2}
                fill={col.stroke}
                rx={2}
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  values="0;0.72;0"
                  keyTimes="0;0.12;1"
                  dur="0.42s"
                  begin="0s"
                  fill="freeze"
                />
              </rect>
            )}
            <text
              x={rx + mw / 2}
              y={ry + mh / 2 + 2.5}
              textAnchor="middle"
              fontSize={4.5}
              fontWeight="bold"
              fill={col.stroke}
              fontFamily="monospace"
              opacity={0.9}
              style={{ pointerEvents: 'none' }}
            >
              {MINIMAP_ZONE_LABELS[z.id]}
            </text>
          </g>
        );
      })}

      {/* Team member dots */}
      {assignedMembers.map(m => {
        const pos = ROLE_POSITIONS[m.assignedRole] ?? ROLE_POSITIONS.none;
        const dx = (pos.x / 100) * MAP_W;
        const dy = (pos.y / 100) * MAP_H;
        const color = ROLE_DOT_COLOR[m.assignedRole] ?? '#9ca3af';
        const isHovered = hoveredId === m.id;
        const isTarget = targetMemberId === m.id;
        const r = isHovered ? 4.5 : 3.5;
        return (
          <g
            key={m.id}
            style={{ cursor: 'default' }}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {isTarget && (
              <motion.circle
                cx={dx} cy={dy}
                r={5}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                animate={{ r: [5, 8, 5], opacity: [0.9, 0.2, 0.9] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            <circle cx={dx} cy={dy} r={r} fill={color} opacity={isTarget ? 1 : 0.9} />
            <circle cx={dx} cy={dy} r={r} fill="none" stroke="#000" strokeWidth={0.8} opacity={0.5} />
            {isTarget && (
              <circle cx={dx} cy={dy} r={r} fill="none" stroke={color} strokeWidth={1} opacity={0.8} />
            )}
          </g>
        );
      })}

      {/* Tooltip for hovered dot */}
      {hoveredMember && (() => {
        const pos = ROLE_POSITIONS[hoveredMember.assignedRole] ?? ROLE_POSITIONS.none;
        const dx = (pos.x / 100) * MAP_W;
        const dy = (pos.y / 100) * MAP_H;
        const color = ROLE_DOT_COLOR[hoveredMember.assignedRole] ?? '#9ca3af';
        const label = `${hoveredMember.name} — ${ROLE_FULL[hoveredMember.assignedRole]}`;
        const tipW = Math.min(label.length * 2.85 + 4, 68);
        const tipH = 10;
        const tipX = Math.max(1, Math.min(dx - tipW / 2, MAP_W - tipW - 1));
        const tipY = dy - tipH - 6 < 1 ? dy + 6 : dy - tipH - 6;
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={tipX} y={tipY} width={tipW} height={tipH}
              rx={2} ry={2}
              fill="#0f172a"
              stroke={color}
              strokeWidth={0.8}
              opacity={0.97}
            />
            <text
              x={tipX + tipW / 2}
              y={tipY + tipH / 2 + 2}
              textAnchor="middle"
              fontSize={3.8}
              fill="#e2e8f0"
              fontFamily="monospace"
              style={{ pointerEvents: 'none' }}
            >
              {label}
            </text>
          </g>
        );
      })()}

      {/* North label */}
      <text x={MAP_W / 2} y={5} textAnchor="middle" fontSize={3.5} fill="#374151" fontFamily="monospace">
        AIRWAY END
      </text>
      {/* South label */}
      <text x={MAP_W / 2} y={MAP_H - 1} textAnchor="middle" fontSize={3.5} fill="#374151" fontFamily="monospace">
        DOOR
      </text>
    </svg>
  );
}

/* ── Main component ───────────────────────────────────────────────── */

interface IsometricRoomProps {
  ui: UIState;
  actions: EngineActions;
}

/* ── Callout tag full names ───────────────────────────────────────── */

const ZONE_CALLOUT: Record<ZoneId, string> = {
  patient_bed:        'Patient Bed',
  defib_station:      'Defib / Monitor',
  medication_station: 'Medication Cart',
  airway_station:     'Airway Equipment',
  door:               'Team Actions',
};

const ZONE_TAG_COLOR: Record<ZoneId, string> = {
  airway_station:     '#f59e0b',
  medication_station: '#22c55e',
  defib_station:      '#ef4444',
  patient_bed:        '#3b82f6',
  door:               '#6b7280',
};

export default function IsometricRoom({ ui, actions }: IsometricRoomProps) {
  const [menu, setMenu] = useState<ActiveMenu | null>(null);
  const { prefs, setPrefs, synced } = useUserPreferences();
  const minimapVisible = prefs.minimapVisible;
  const [mapZoom, setMapZoom] = useState<number>(() => {
    const stored = localStorage.getItem(MINIMAP_ZOOM_KEY);
    if (stored === null) return MINIMAP_ZOOM_DEFAULT;
    const parsed = parseFloat(stored);
    if (isNaN(parsed)) return MINIMAP_ZOOM_DEFAULT;
    return Math.max(MINIMAP_ZOOM_MIN, Math.min(MINIMAP_ZOOM_MAX, parsed));
  });
  const [mapZoomResetting, setMapZoomResetting] = useState(false);
  const mapZoomResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetMapZoom() {
    setMapZoom(MINIMAP_ZOOM_DEFAULT);
    localStorage.setItem(MINIMAP_ZOOM_KEY, String(MINIMAP_ZOOM_DEFAULT));
    if (mapZoomResetTimer.current) clearTimeout(mapZoomResetTimer.current);
    setMapZoomResetting(true);
    mapZoomResetTimer.current = setTimeout(() => setMapZoomResetting(false), 400);
  }

  const [hoveredZone, setHoveredZone] = useState<ZoneId | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Callout tag visibility — visible for first 8 s when preference allows, then fade out */
  const [showInitialTags, setShowInitialTags] = useState(() => prefs.tagsVisible);
  /* Per-zone flash: set of zone ids briefly re-shown after a click */
  const [flashedZones, setFlashedZones] = useState<Set<ZoneId>>(new Set());
  const flashTimers = useRef<Map<ZoneId, ReturnType<typeof setTimeout>>>(new Map());
  /* Minimap zone flash: brief brightness pulse after a successful action */
  const [flashedMinimapZones, setFlashedMinimapZones] = useState<Set<ZoneId>>(new Set());
  const minimapFlashTimers = useRef<Map<ZoneId, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!prefs.tagsVisible) {
      setShowInitialTags(false);
      return;
    }
    setShowInitialTags(true);
    const t = setTimeout(() => setShowInitialTags(false), 8000);
    return () => clearTimeout(t);
  }, [synced, prefs.tagsVisible]);

  function flashZoneTag(id: ZoneId) {
    setFlashedZones(prev => new Set(prev).add(id));
    const existing = flashTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setFlashedZones(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      flashTimers.current.delete(id);
    }, 2500);
    flashTimers.current.set(id, t);
  }

  function flashMinimapZone(id: ZoneId) {
    setFlashedMinimapZones(prev => new Set(prev).add(id));
    const existing = minimapFlashTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setFlashedMinimapZones(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      minimapFlashTimers.current.delete(id);
    }, 500);
    minimapFlashTimers.current.set(id, t);
  }

  const isShockable = ui.rhythm === 'vfib' || ui.rhythm === 'vtach';
  const isArrest = isShockable || ui.rhythm === 'pea' || ui.rhythm === 'asystole';
  const hasAccess = ui.hasIVAccess || ui.hasIOAccess;
  const amioDose = ui.amiodaroneDoses === 0 ? AMIODARONE_FIRST_DOSE_MG : AMIODARONE_SUBSEQUENT_DOSE_MG;
  const openOrder = [...ui.pendingOrders].reverse().find(o => NON_TERMINAL.has(o.status)) ?? null;

  const chaosRatio = Math.min(1, ui.chaosFiredCount / 8);

  function close() { setMenu(null); }
  function act(fn: () => void) {
    if (menu) flashMinimapZone(menu.targetId as ZoneId);
    fn();
    close();
  }

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
      className="relative w-full h-full bg-gray-950 overflow-hidden select-none"
      onClick={() => setMenu(null)}
    >
      {/*
        Inner scene div — constrained to viewBox aspect ratio so that
        preserveAspectRatio="none" on the SVG causes no distortion,
        and all overlay % positions are correctly aligned with SVG content.
      */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          transformOrigin: 'center center',
          width: '100%',
          aspectRatio: `${ROOM_W} / ${VIEW_H}`,
          maxHeight: '100%',
        }}
        onMouseMove={e => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setCursorPos({
            x: (e.clientX - rect.left) / rect.width * 100,
            y: (e.clientY - rect.top) / rect.height * 100,
          });
        }}
        onMouseLeave={() => setCursorPos(null)}
      >
      {/* ── Isometric room SVG ── */}
      <svg
        viewBox={`0 ${VIEW_MIN_Y} ${ROOM_W} ${VIEW_H}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
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
        <rect x="0" y="0" width={ROOM_W} height={ROOM_H} fill="#060a14" style={{ pointerEvents: 'none' }} />
        <rect x="0" y="0" width={ROOM_W} height={ROOM_H} fill="url(#floor-grid)" opacity="0.4" style={{ pointerEvents: 'none' }} />

        {/* Room outline — large isometric floor */}
        <polygon
          points={isoFloor(500, 340, 940, 470)}
          fill="#0a0f1a"
          stroke="#1e293b"
          strokeWidth="1"
          style={{ pointerEvents: 'none' }}
        />

        {/* Render zones back-to-front (painter's algorithm) */}
        {ZONES.map(z => {
          const isCprBed = z.id === 'patient_bed' && ui.cprActive;
          const isCharged = z.id === 'defib_station' && ui.defibCharged;
          const isShockableZone = z.id === 'defib_station' && isShockable;
          const strokeColor = isCharged ? '#fbbf24' : isShockableZone ? '#f97316' : z.topStroke;
          const strokeW = isCharged || isCprBed ? 2.5 : 1.5;
          const hasFurniture = z.id !== 'door';
          const pct = zoneToPct(z.cx, z.cy);

          const isHoveredFurniture = hasFurniture && hoveredZone === z.id;
          const isMenuOpen = hasFurniture && menu?.targetId === z.id;
          const hoverFilter = isMenuOpen
            ? `brightness(1.55) drop-shadow(0 0 14px ${ZONE_HOVER_GLOW[z.id]})`
            : isHoveredFurniture
            ? `brightness(1.38) drop-shadow(0 0 10px ${ZONE_HOVER_GLOW[z.id]})`
            : 'brightness(1)';

          return (
            <g
              key={z.id}
              {...(hasFurniture ? {
                onClick: (e: React.MouseEvent<SVGGElement>) => {
                  e.stopPropagation();
                  flashZoneTag(z.id);
                  const rect = containerRef.current?.getBoundingClientRect();
                  const anchor = rect
                    ? { x: (e.clientX - rect.left) / rect.width * 100, y: (e.clientY - rect.top) / rect.height * 100 }
                    : { x: pct.x - 2, y: pct.y - 10 };
                  openZoneMenu(z.id, anchor);
                },
                onMouseEnter: () => setHoveredZone(z.id),
                onMouseLeave: () => setHoveredZone(null),
                style: { cursor: 'pointer', filter: hoverFilter, transition: 'filter 0.18s ease' },
              } : { style: { pointerEvents: 'none' as const } })}
            >
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

      {/* ── Clickable zone overlays — door only (furniture zones use SVG click targets) ── */}
      {ZONES.filter(z => z.id === 'door').map(z => {
        const pct = zoneToPct(z.cx, z.cy);
        return (
          <div
            key={z.id}
            className="absolute cursor-pointer"
            style={{
              left: `${pct.x - 8}%`,
              top: `${pct.y - 6}%`,
              width: `${(z.w / ROOM_W) * 100 * 1.1}%`,
              height: `${(z.h / VIEW_H) * 100 * 1.2}%`,
              zIndex: 5,
            }}
            onMouseEnter={() => setHoveredZone(z.id)}
            onMouseLeave={() => setHoveredZone(null)}
            onClick={e => {
              e.stopPropagation();
              flashZoneTag(z.id);
              const rect = containerRef.current?.getBoundingClientRect();
              const anchor = rect
                ? { x: (e.clientX - rect.left) / rect.width * 100, y: (e.clientY - rect.top) / rect.height * 100 }
                : { x: pct.x - 2, y: pct.y - 10 };
              openZoneMenu(z.id, anchor);
            }}
            title={`Click: ${z.label}`}
          />
        );
      })}

      {/* ── Callout tags — pill labels floating above each zone ── */}
      {ZONES.map((z, zoneIndex) => {
        const pct = zoneToPct(z.cx, z.cy);
        const tagVisible = showInitialTags || flashedZones.has(z.id) || menu?.targetId === z.id;
        const isMenuOpen = menu?.targetId === z.id;
        const color = ZONE_TAG_COLOR[z.id];
        // Stagger delay only on initial load; flashed/menu-opened tags enter immediately
        const entranceDelay = showInitialTags && !flashedZones.has(z.id) ? zoneIndex * 0.06 : 0;
        return (
          <AnimatePresence key={`tag-${z.id}`}>
            {tagVisible && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.92 }}
                animate={isMenuOpen
                  ? { opacity: 1, y: 0, scale: [1.12, 1.08, 1.12] }
                  : { opacity: 1, y: 0, scale: 1 }
                }
                exit={{ opacity: 0, y: -4, scale: 0.92 }}
                transition={isMenuOpen
                  ? { duration: 0.25, scale: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } }
                  : { delay: entranceDelay, scale: { type: 'spring', stiffness: 380, damping: 18, mass: 0.7 }, y: { type: 'spring', stiffness: 380, damping: 18, mass: 0.7 }, opacity: { duration: 0.18 } }
                }
                style={{
                  position: 'absolute',
                  left: `${pct.x}%`,
                  top: `${pct.y - 12}%`,
                  transform: 'translate(-50%, -100%)',
                  zIndex: isMenuOpen ? 12 : 10,
                  pointerEvents: 'none',
                }}
              >
                {/* Tail connector line */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: isMenuOpen ? '2px' : '1px',
                    height: '8px',
                    background: color,
                    opacity: isMenuOpen ? 1 : 0.6,
                  }}
                />
                {/* Pill tag */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    border: `${isMenuOpen ? '2px' : '1.5px'} solid ${color}`,
                    background: isMenuOpen ? `${color}30` : `${color}18`,
                    backdropFilter: 'blur(4px)',
                    whiteSpace: 'nowrap',
                    boxShadow: isMenuOpen
                      ? `0 0 8px 2px ${color}55, 0 0 18px 4px ${color}25`
                      : 'none',
                    transition: 'box-shadow 0.25s, border 0.25s, background 0.25s',
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                      boxShadow: isMenuOpen ? `0 0 4px 1px ${color}` : 'none',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      fontWeight: 700,
                      color,
                      letterSpacing: '0.04em',
                      textShadow: isMenuOpen ? `0 0 6px ${color}` : 'none',
                    }}
                  >
                    {ZONE_CALLOUT[z.id]}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );
      })}

      {/* ── Staff avatars ── */}
      {ui.team.map(m => {
        const pos = ROLE_POSITIONS[m.assignedRole] ?? ROLE_POSITIONS.none;
        const isFatigued = m.fatigueLevel > 0.5;
        const isCpr = m.assignedRole === 'compressor' && ui.cprActive;
        const hasSpeech = !!m.speech && ui.clock < m.speech.until;

        return (
          <motion.div
            key={m.id}
            className="absolute"
            initial={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
            style={{ transform: 'translate(-50%,-50%)', zIndex: 20 }}
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
          </motion.div>
        );
      })}

      {/* ── Cursor tooltip — shown on furniture hover when menu is not open for that zone ── */}
      <AnimatePresence>
        {hoveredZone && cursorPos && menu?.targetId !== hoveredZone && (
          <motion.div
            key={hoveredZone}
            initial={{ opacity: 0, scale: 0.92, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 2 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: `${Math.min(cursorPos.x + 2, 78)}%`,
              top: `${Math.max(cursorPos.y - 14, 2)}%`,
              pointerEvents: 'none',
              zIndex: 45,
              whiteSpace: 'nowrap',
            }}
          >
            <div
              style={{
                background: 'rgba(10,14,28,0.92)',
                border: `1px solid ${ZONE_HOVER_GLOW[hoveredZone]}`,
                borderRadius: '6px',
                padding: '4px 10px',
                backdropFilter: 'blur(6px)',
                boxShadow: `0 2px 12px ${ZONE_HOVER_GLOW[hoveredZone]}44`,
              }}
            >
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#e2e8f0',
                  letterSpacing: '0.03em',
                }}
              >
                {MINIMAP_ZONE_FULL_LABEL[hoveredZone]}
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '8px',
                  color: '#94a3b8',
                  marginTop: '1px',
                  letterSpacing: '0.02em',
                }}
              >
                Click for actions
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
      </div>{/* ── end inner scene div ── */}

      {/* ── Floor plan minimap ── */}
      <div
        className="absolute z-30"
        style={{ bottom: '2.5rem', right: '0.75rem' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Toggle + zoom controls */}
        <div className="flex items-center justify-end gap-0.5 mb-0.5">
          {minimapVisible && (
            <>
              <button
                onClick={() => setMapZoom(z => {
                  const next = Math.max(MINIMAP_ZOOM_MIN, parseFloat((z - MINIMAP_ZOOM_STEP).toFixed(2)));
                  localStorage.setItem(MINIMAP_ZOOM_KEY, String(next));
                  return next;
                })}
                disabled={mapZoom <= MINIMAP_ZOOM_MIN}
                className="px-1 py-px rounded text-[8px] font-bold border border-gray-700 bg-gray-900/80 text-gray-500 hover:text-gray-300 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors leading-none"
                title="Zoom out minimap"
              >−</button>
              <span className="px-1 text-[8px] font-mono text-gray-500 leading-none tabular-nums select-none">
                {mapZoom % 1 === 0 ? `${mapZoom}×` : `${mapZoom.toFixed(1)}×`}
              </span>
              <button
                onClick={() => setMapZoom(z => {
                  const next = Math.min(MINIMAP_ZOOM_MAX, parseFloat((z + MINIMAP_ZOOM_STEP).toFixed(2)));
                  localStorage.setItem(MINIMAP_ZOOM_KEY, String(next));
                  return next;
                })}
                disabled={mapZoom >= MINIMAP_ZOOM_MAX}
                className="px-1 py-px rounded text-[8px] font-bold border border-gray-700 bg-gray-900/80 text-gray-500 hover:text-gray-300 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors leading-none"
                title="Zoom in minimap"
              >+</button>
            </>
          )}
          <button
            onClick={() => setPrefs(p => ({ ...p, minimapVisible: !p.minimapVisible }))}
            className="px-1.5 py-px rounded text-[8px] font-bold tracking-widest border border-gray-700 bg-gray-900/80 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors leading-none"
            title={minimapVisible ? 'Hide floor plan' : 'Show floor plan'}
          >
            {minimapVisible ? 'MAP ▾' : 'MAP ▸'}
          </button>
        </div>

        <AnimatePresence>
          {minimapVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 4 }}
              transition={{ duration: 0.15 }}
              className="rounded overflow-hidden shadow-xl"
              style={{
                background: 'rgba(6,10,20,0.82)',
                backdropFilter: 'blur(4px)',
                border: mapZoomResetting
                  ? '1px solid rgba(250,204,21,0.85)'
                  : '1px solid rgba(55,65,81,0.7)',
                boxShadow: mapZoomResetting
                  ? '0 0 8px 2px rgba(250,204,21,0.4)'
                  : undefined,
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onDoubleClick={e => { e.stopPropagation(); resetMapZoom(); }}
              title="Double-click to reset zoom"
            >
              <FloorPlanMinimap
                activeZone={hoveredZone}
                zoom={mapZoom}
                flashedZones={flashedMinimapZones}
                menuZone={(menu?.targetId as ZoneId) ?? null}
                onZoneClick={id => {
                  const z = ZONES.find(z => z.id === id);
                  if (z) openZoneMenu(id, zoneToPct(z.cx, z.cy));
                }}
                members={ui.team}
                targetMemberId={menu?.targetId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
    y: ((cy - VIEW_MIN_Y) / VIEW_H) * 100,
  };
}
