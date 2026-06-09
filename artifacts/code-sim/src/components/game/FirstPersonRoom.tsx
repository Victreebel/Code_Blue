import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UIState } from '../../engine/ui/uiStateEngine';
import type { EngineActions } from '../../engine/useGameEngine';
import type { TeamMemberRuntime } from '../../engine/types/team';
import type { TeamRole } from '../../engine/types/core';
import { AMIODARONE_FIRST_DOSE_MG, AMIODARONE_SUBSEQUENT_DOSE_MG } from '../../engine/clinical/aclsConstants';

/* ── Scene constants ───────────────────────────────────────────────── */

const SW   = 900;   // scene width  (px)
const SH   = 480;   // scene height (px)
const SD   = 540;   // room depth   (px, back wall z-distance)
const PERSP = 720;  // CSS perspective (px)

/* perspective origin within the scene coordinate space */
const OX = SW / 2;      // 450 — horizontal centre
const OY = SH * 0.36;   // ≈ 173 — slightly above mid = eye level

/* y at which character feet are anchored (floor level in scene coords) */
const FLOOR_Y = SH - 50; // ≈ 430

const AVATAR_R = 22;  // avatar circle radius (px)

/* ── 3D world positions for each role ─────────────────────────────── */
/* x: 0 (left wall) → SW (right wall), z: 0 (door) → −SD (back wall) */
const ROLE_3D: Record<TeamRole, { x: number; z: number }> = {
  airway:        { x: 450,  z: -508 },
  monitor_defib: { x: 790,  z: -365 },
  medication:    { x: 110,  z: -365 },
  iv_access:     { x: 320,  z: -250 },
  compressor:    { x: 450,  z: -238 },
  leader:        { x: 590,  z: -165 },
  recorder:      { x: 110,  z: -108 },
  timekeeper:    { x: 778,  z: -100 },
  none:          { x: 840,  z: -52  },
};

/* ── Perspective projection helper ─────────────────────────────────── */
function project(x3d: number, z3d: number): { x: number; y: number; s: number } {
  const s = PERSP / (PERSP + Math.abs(z3d));
  return {
    x: OX + (x3d - OX) * s,
    y: OY + (FLOOR_Y - OY) * s,
    s,
  };
}

/* ── Role labels / styling ─────────────────────────────────────────── */
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

function fatigueHaloColor(f: number) {
  return f < 0.35 ? '#22c55e' : f < 0.65 ? '#f59e0b' : '#ef4444';
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

const NON_TERMINAL = new Set(['issued', 'heard', 'acknowledged', 'in_progress']);

/* ── Menu types ─────────────────────────────────────────────────────── */
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

function menuItemCls(v: MenuAction['variant'], disabled?: boolean): string {
  if (disabled) return 'text-gray-600 cursor-not-allowed bg-gray-900/40';
  const base = 'hover:brightness-110 cursor-pointer transition-[filter]';
  switch (v) {
    case 'red':         return `${base} bg-red-900/60 text-red-200`;
    case 'amber':       return `${base} bg-amber-900/50 text-amber-200`;
    case 'amberFilled': return 'bg-amber-700 text-amber-50 cursor-default';
    case 'blue':        return `${base} bg-blue-900/50 text-blue-200`;
    case 'green':       return `${base} bg-green-900/50 text-green-200`;
    default:            return `${base} bg-gray-800/70 text-gray-300`;
  }
}

/* ── Component ─────────────────────────────────────────────────────── */
interface FirstPersonRoomProps {
  ui: UIState;
  actions: EngineActions;
}

export default function FirstPersonRoom({ ui, actions }: FirstPersonRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<ActiveMenu | null>(null);

  const isShockable = ui.rhythm === 'vfib' || ui.rhythm === 'vtach';
  const isArrest    = isShockable || ui.rhythm === 'pea' || ui.rhythm === 'asystole';
  const hasAccess   = ui.hasIVAccess || ui.hasIOAccess;
  const amioDose    = ui.amiodaroneDoses === 0 ? AMIODARONE_FIRST_DOSE_MG : AMIODARONE_SUBSEQUENT_DOSE_MG;
  const openOrder   = [...ui.pendingOrders].reverse().find(o => NON_TERMINAL.has(o.status)) ?? null;
  const chaosRatio  = Math.min(1, ui.chaosFiredCount / 8);

  function close() { setMenu(null); }
  function act(fn: () => void) { fn(); close(); }

  function anchor(e: React.MouseEvent): { x: number; y: number } {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return { x: 30, y: 30 };
    const x = ((e.clientX - r.left) / r.width)  * 100;
    const y = ((e.clientY - r.top)  / r.height) * 100;
    return { x: clamp(x, 5, 72), y: clamp(y, 5, 65) };
  }

  /* ── Action menus (identical to IsometricRoom) ─────────────────── */
  function airwayMenu(): MenuAction[] {
    const items: MenuAction[] = [];
    if (!ui.hasAdvancedAirway) {
      items.push({ label: 'BVM Ventilate', variant: 'gray', onSelect: () => act(actions.airwayBvm) });
      items.push({ label: 'Advanced Airway (ETT/LMA)', variant: 'amber', onSelect: () => act(actions.airwayAdvanced) });
    } else {
      items.push({ label: '✓ Advanced Airway Secured', variant: 'amberFilled', onSelect: () => {} });
    }
    return items;
  }

  function medicationMenu(): MenuAction[] {
    const items: MenuAction[] = [];
    items.push({ label: `Epinephrine 1mg IV/IO`, variant: 'red',
      onSelect: () => act(() => actions.medication('epinephrine', 1)) });
    items.push({ label: `Amiodarone ${amioDose}mg`,  variant: 'amber',
      sublabel: `Given: ${ui.amiodaroneDoses}×`,
      disabled: !isShockable,
      onSelect: () => act(() => actions.medication('amiodarone', amioDose)) });
    items.push({ label: 'Sodium Bicarb 1 mEq/kg', variant: 'blue',
      onSelect: () => act(() => actions.medication('bicarb', 50)) });
    return items;
  }

  function ivMenu(): MenuAction[] {
    const items: MenuAction[] = [];
    if (!ui.hasIVAccess)
      items.push({ label: 'Establish IV Access', variant: 'blue', onSelect: () => act(actions.ivAccess) });
    else
      items.push({ label: '✓ IV Line Established', variant: 'amberFilled', onSelect: () => {} });
    if (!ui.hasIOAccess)
      items.push({ label: 'Establish IO Access', variant: 'blue', onSelect: () => act(actions.ioAccess) });
    else
      items.push({ label: '✓ IO Access Established', variant: 'amberFilled', onSelect: () => {} });
    return items;
  }

  function defibMenu(): MenuAction[] {
    const items: MenuAction[] = [];
    if (!ui.defibCharged) {
      items.push({ label: 'Charge Defib (200J)', variant: 'amber',
        disabled: !isShockable,
        onSelect: () => act(actions.chargeDefib) });
    } else {
      items.push({ label: '⚡ DELIVER SHOCK (200J)', variant: 'red',
        onSelect: () => act(actions.shock) });
    }
    items.push({ label: 'Analyse Rhythm', variant: 'gray', onSelect: () => act(actions.rhythmCheck) });
    items.push({ label: ui.cprActive ? 'Pause CPR' : 'Start CPR', variant: ui.cprActive ? 'amber' : 'green',
      onSelect: () => act(ui.cprActive ? actions.pauseCpr : actions.startCpr) });
    return items;
  }

  function patientMenu(): MenuAction[] {
    return [
      { label: ui.cprActive ? 'Pause CPR' : 'Start CPR', variant: ui.cprActive ? 'amber' : 'green',
        onSelect: () => act(ui.cprActive ? actions.pauseCpr : actions.startCpr) },
      { label: 'Check Pulse', variant: 'gray', onSelect: () => act(actions.pulseCheck) },
      { label: 'Check Rhythm', variant: 'gray', onSelect: () => act(actions.rhythmCheck) },
    ];
  }

  function doorMenu(): MenuAction[] {
    return [
      { label: 'Announce Cycle',   variant: 'gray', onSelect: () => act(actions.announceCycle) },
      { label: 'Call Time of Death', variant: 'red', onSelect: () => act(actions.callTimeOfDeath) },
      { label: 'Declare ROSC',     variant: 'green', onSelect: () => act(actions.declareRosc) },
    ];
  }

  function memberMenu(m: TeamMemberRuntime): MenuAction[] {
    const items: MenuAction[] = [];
    const isFatigued = m.fatigueLevel > 0.5;
    if (m.assignedRole === 'compressor')
      items.push({ label: isFatigued ? '⚠ Rotate Compressor' : 'Rotate Compressor',
        variant: isFatigued ? 'red' : 'gray', onSelect: () => act(actions.switchCompressor) });
    if (openOrder)
      items.push({ label: `CLC: "${openOrder.label.slice(0, 22)}…"`, variant: 'amber',
        onSelect: () => act(() => actions.requestClosedLoop(openOrder.id)) });
    const QUICK: TeamRole[] = ['airway', 'iv_access', 'medication', 'monitor_defib', 'compressor', 'recorder'];
    for (const role of QUICK)
      if (m.assignedRole !== role)
        items.push({ label: `→ ${ROLE_FULL[role]}`, variant: 'gray',
          onSelect: () => act(() => actions.assignRole(m.id, role)) });
    if (!m.confirmedRole && m.assignedRole !== 'none')
      items.push({ label: 'Confirm Role (Closed-Loop)', variant: 'green',
        onSelect: () => act(() => actions.confirmRole(m.id)) });
    return items;
  }

  /* ── Rhythm ECG path ── */
  function ecgPath(): string {
    if (isShockable)
      return 'M0,20 L15,20 L23,4 L31,36 L39,4 L46,20 L70,20 L78,4 L86,36 L94,4 L101,20 L160,20';
    if (ui.rhythm === 'pea' || ui.rhythm === 'asystole')
      return 'M0,20 L160,20';
    return 'M0,20 L18,20 L22,10 L26,30 L30,10 L33,20 L60,20 L64,10 L68,30 L72,10 L75,20 L110,20 L114,10 L118,30 L122,10 L125,20 L160,20';
  }

  /* ── Furniture geometry constants ──────────────────────────────── */

  /* Patient bed */
  const BED_CX = 450;
  const BED_W  = 148;   // left-right width
  const BED_FH = 56;    // frame height (floor to mattress surface)
  const BED_L  = 268;   // length front-to-back in z
  const BED_RH = 22;    // side-rail height above mattress
  const BED_FZ = -140;  // z of footboard face

  /* Crash cart (left wall, x = 0..CC_DEPTH, z = CC_Z..CC_Z-CC_ZW) */
  const CC_DEPTH = 58;   // protrusion into room (x)
  const CC_ZW    = 70;   // width along wall (z extent)
  const CC_H     = 132;  // height
  const CC_Z     = -278; // z of near face (toward viewer)

  /* Defib unit (right wall, x = SW-DF_DEPTH..SW, z = DF_Z..DF_Z-DF_ZW) */
  const DF_DEPTH = 58;
  const DF_ZW    = 70;
  const DF_H     = 172;  // taller than crash cart (stand + monitor)
  const DF_Z     = -278;

  /* Airway cabinet (back wall centre, protrudes toward viewer) */
  const AW_CX  = SW / 2;
  const AW_W   = 216;   // left-right width
  const AW_H   = 170;   // height
  const AW_D   = 42;    // protrusion toward viewer
  const AW_L   = SW / 2 - AW_W / 2;   // left edge x = 342

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: '#020509' }}
      onClick={() => setMenu(null)}
    >

      {/* ══════════════════════════════════════════════════════════════
          CSS 3D PERSPECTIVE ROOM
          All 3D geometry lives here — walls (background), then each
          piece of furniture as a standalone box.  Team members are
          a 2D projected overlay rendered separately.
      ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute', inset: 0,
          perspective: `${PERSP}px`,
          perspectiveOrigin: '50% 36%',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* ── Scene wrapper (SW × SH, centred) ── */}
        <div
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: SW, height: SH,
            marginLeft: -SW / 2,
            marginTop: -SH / 2,
            transformStyle: 'preserve-3d',
          }}
        >

          {/* ── FLOOR ── */}
          <div
            style={{
              position: 'absolute',
              width: SW, height: SD,
              top: SH, left: 0,
              transformOrigin: '0% 0%',
              transform: 'rotateX(-90deg)',
              background:
                'repeating-linear-gradient(90deg,transparent,transparent 59px,rgba(255,255,255,0.025) 60px),' +
                'repeating-linear-gradient(0deg,transparent,transparent 59px,rgba(255,255,255,0.025) 60px),' +
                'linear-gradient(to bottom, #0d1220 0%, #070c14 100%)',
            }}
          />

          {/* ── CEILING with fluorescent strip lights ── */}
          <div
            style={{
              position: 'absolute',
              width: SW, height: SD,
              top: 0, left: 0,
              transformOrigin: '0% 100%',
              transform: 'rotateX(90deg)',
              background: '#040710',
            }}
          >
            {[0.22, 0.5, 0.78].map(t => (
              <div
                key={t}
                style={{
                  position: 'absolute',
                  left: `${t * 100}%`, top: '15%',
                  transform: 'translateX(-50%)',
                  width: 50, height: '70%',
                  background: 'rgba(170,200,255,0.07)',
                  boxShadow: '0 0 40px 14px rgba(150,185,255,0.09)',
                  borderRadius: 2,
                }}
              />
            ))}
          </div>

          {/* ── BACK WALL background ── */}
          <div
            style={{
              position: 'absolute',
              width: SW, height: SH,
              top: 0, left: 0,
              transform: `translateZ(-${SD}px)`,
              background: 'linear-gradient(180deg, #06091a 0%, #080d1f 100%)',
              borderBottom: '2px solid #1e293b',
              pointerEvents: 'none',
            }}
          >
            {/* Wall-mounted clock (decorative) */}
            <div style={{
              position: 'absolute', top: 12, right: 24,
              width: 44, height: 44, borderRadius: '50%',
              border: '2px solid #1a2236', background: '#060a14',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: '#1a2236',
            }}>🕐</div>
            {/* HEAD OF BED label */}
            <div style={{
              position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              color: '#1e3a5f', fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.15em',
            }}>▲ HEAD OF BED</div>
          </div>

          {/* ── LEFT WALL background ── */}
          <div
            style={{
              position: 'absolute',
              width: SD, height: SH,
              top: 0, left: 0,
              transformOrigin: '0% 50%',
              transform: 'rotateY(90deg)',
              background: 'linear-gradient(180deg, #06091a 0%, #07080d 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* ── RIGHT WALL background ── */}
          <div
            style={{
              position: 'absolute',
              width: SD, height: SH,
              top: 0, right: 0,
              transformOrigin: '100% 50%',
              transform: 'rotateY(-90deg)',
              background: 'linear-gradient(180deg, #07050e 0%, #060408 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* ══════════════════════════════════════════════════════════
              3-D FURNITURE — each piece is built from CSS-3d faces
              positioned directly in the scene's preserve-3d context.

              Coordinate system:
                x: 0 (left wall) → 900 (right wall)
                y: 0 (ceiling) → 480 (floor, SH)
                z: 0 (door/viewer) → -540 (back wall, -SD)

              Transforms applied left-to-right (translateZ first,
              then rotateX/Y).  TransformOrigin is the rotation
              pivot within the element's pre-rotated 2-D position.
          ════════════════════════════════════════════════════════════ */}

          {/* ╔══════════════════════════════════════════════════════╗
              ║  AIRWAY CABINET  (back wall, centre, z ≈ -498..−540) ║
              ╚══════════════════════════════════════════════════════╝ */}

          {/* Front face — faces viewer, clickable */}
          <div
            style={{
              position: 'absolute',
              left: AW_L, top: SH - AW_H,
              width: AW_W, height: AW_H,
              transform: `translateZ(${-SD + AW_D}px)`,
              background: 'linear-gradient(180deg, #0b1525 0%, #0d1c30 100%)',
              border: `2px solid ${ui.hasAdvancedAirway ? '#22c55e' : '#d97706'}`,
              borderRadius: 3,
              boxShadow: `0 0 22px ${ui.hasAdvancedAirway ? '#22c55e28' : '#d9770628'}`,
              cursor: 'pointer',
              pointerEvents: 'auto',
              overflow: 'hidden',
            }}
            onClick={e => {
              e.stopPropagation();
              setMenu({ targetId: 'airway_station', title: 'Airway Equipment', items: airwayMenu(), anchor: anchor(e) });
            }}
          >
            {/* Header stripe */}
            <div style={{
              background: ui.hasAdvancedAirway ? '#14532d' : '#78350f',
              borderBottom: `1px solid ${ui.hasAdvancedAirway ? '#22c55e' : '#d97706'}`,
              padding: '4px 10px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ color: ui.hasAdvancedAirway ? '#86efac' : '#fcd34d', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.12em' }}>
                AIRWAY MGT
              </span>
              <span style={{ marginLeft: 'auto', color: ui.hasAdvancedAirway ? '#4ade80' : '#fbbf24', fontSize: 9 }}>
                {ui.hasAdvancedAirway ? '✓ SECURED' : 'UNSECURED'}
              </span>
            </div>

            {/* Ventilator waveform display */}
            <div style={{
              margin: '8px 10px 4px',
              height: 40,
              background: '#040a12',
              border: '1px solid #1e293b',
              borderRadius: 2, overflow: 'hidden', padding: '4px 6px',
            }}>
              <svg viewBox="0 0 200 30" style={{ width: '100%', height: '100%' }}>
                <path
                  d="M0,15 L20,15 L24,3 L28,27 L32,3 L36,15 L70,15 L74,3 L78,27 L82,3 L86,15 L130,15 L134,3 L138,27 L142,3 L146,15 L200,15"
                  stroke={ui.hasAdvancedAirway ? '#22c55e' : '#d97706'}
                  strokeWidth="1.5" fill="none"
                />
              </svg>
            </div>

            {/* Equipment shelves */}
            {[
              ['BVM', '#2563eb'],
              ['LARYNGOSCOPE', '#6b7280'],
              ['ET TUBES', '#4b5563'],
              ['SUCTION', '#374151'],
            ].map(([label, col], i) => (
              <div key={i} style={{
                margin: '3px 10px',
                padding: '3px 8px',
                background: '#060f1a',
                border: '1px solid #1e293b',
                borderRadius: 2,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                <span style={{ color: '#374151', fontSize: 8, fontFamily: 'monospace' }}>{label}</span>
              </div>
            ))}

            {/* Click hint */}
            <div style={{ position: 'absolute', bottom: 5, right: 8, color: '#1e3a5f', fontSize: 7, fontFamily: 'monospace' }}>
              click to manage
            </div>
          </div>

          {/* Airway cabinet — top face (horizontal, connects wall to front face) */}
          <div style={{
            position: 'absolute',
            left: AW_L, top: SH - AW_H,
            width: AW_W, height: AW_D,
            transformOrigin: 'center top',
            transform: `translateZ(-${SD}px) rotateX(90deg)`,
            background: 'linear-gradient(to bottom, #0a1828 0%, #0d1c30 100%)',
            borderLeft: '1px solid #1e293b',
            borderRight: '1px solid #1e293b',
            pointerEvents: 'none',
          }} />

          {/* Airway cabinet — left face */}
          <div style={{
            position: 'absolute',
            left: AW_L - AW_D, top: SH - AW_H,
            width: AW_D, height: AW_H,
            transformOrigin: 'right center',
            transform: `translateZ(-${SD}px) rotateY(90deg)`,
            background: '#080e1c',
            pointerEvents: 'none',
          }} />

          {/* Airway cabinet — right face */}
          <div style={{
            position: 'absolute',
            left: AW_L + AW_W, top: SH - AW_H,
            width: AW_D, height: AW_H,
            transformOrigin: 'left center',
            transform: `translateZ(-${SD}px) rotateY(-90deg)`,
            background: '#080e1c',
            pointerEvents: 'none',
          }} />

          {/* ╔══════════════════════════════════════════════════════╗
              ║  CRASH CART  (left wall, red, x=0..58, z≈-278..-348) ║
              ╚══════════════════════════════════════════════════════╝ */}

          {/* Crash cart — near-side face (at z=CC_Z, facing viewer) */}
          <div style={{
            position: 'absolute',
            left: 0, top: SH - CC_H,
            width: CC_DEPTH, height: CC_H,
            transform: `translateZ(${CC_Z}px)`,
            background: 'linear-gradient(180deg, #7f1d1d 0%, #991b1b 100%)',
            borderTop: '2px solid #dc2626',
            borderRight: '2px solid #b91c1c',
            pointerEvents: 'none',
          }} />

          {/* Crash cart — drawer face (at x=CC_DEPTH, facing room centre) */}
          {/* Pivot at right edge so the face sits at x=CC_DEPTH after rotateY(-90°) */}
          <div
            style={{
              position: 'absolute',
              left: CC_DEPTH - CC_ZW,   // right edge aligns to x=CC_DEPTH
              top: SH - CC_H,
              width: CC_ZW,
              height: CC_H,
              transformOrigin: 'right center',
              transform: `translateZ(${CC_Z}px) rotateY(-90deg)`,
              background: 'linear-gradient(180deg, #991b1b 0%, #7f1d1d 100%)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              overflow: 'hidden',
            }}
            onClick={e => {
              e.stopPropagation();
              setMenu({ targetId: 'medication_station', title: 'Medication Cart', items: medicationMenu(), anchor: anchor(e) });
            }}
          >
            {/* Cart header stripe */}
            <div style={{
              background: '#7f1d1d',
              borderBottom: '1px solid #dc2626',
              padding: '3px 6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fca5a5', fontSize: 7, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.1em' }}>
                MED CART
              </span>
            </div>

            {/* 4 drawers */}
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                position: 'absolute',
                top: 22 + i * 26, left: 5, right: 5, height: 22,
                background: i === 0 ? '#4c0519' : '#6b1212',
                border: '1px solid #991b1b',
                borderRadius: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                {/* Drawer handle bar */}
                <div style={{
                  width: 20, height: 4,
                  background: '#f87171',
                  borderRadius: 1,
                  opacity: 0.7,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
                }} />
              </div>
            ))}

            {/* Epi label on top drawer */}
            <div style={{
              position: 'absolute', top: 22, left: 5, right: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 3px',
              pointerEvents: 'none',
            }}>
              <span style={{ color: '#fca5a5', fontSize: 6, fontFamily: 'monospace', opacity: 0.6 }}>
                EPI·AMIO
              </span>
            </div>

            {/* Wheel indicators */}
            <div style={{
              position: 'absolute', bottom: 2,
              left: 4, right: 4,
              display: 'flex', justifyContent: 'space-between',
            }}>
              {[0, 1].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#4b5563', border: '1px solid #374151',
                }} />
              ))}
            </div>
          </div>

          {/* Crash cart — top surface (horizontal) */}
          <div style={{
            position: 'absolute',
            left: 0, top: SH - CC_H,
            width: CC_DEPTH, height: CC_ZW,
            transformOrigin: 'center top',
            transform: `translateZ(${CC_Z}px) rotateX(-90deg)`,
            background: 'linear-gradient(to bottom, #b91c1c 0%, #991b1b 100%)',
            borderLeft: '1px solid #dc2626',
            borderRight: '1px solid #7f1d1d',
            pointerEvents: 'none',
          }} />

          {/* IV access bag — on pole near head of bed, left side */}
          {/* Pole shaft */}
          <div style={{
            position: 'absolute',
            left: 80, top: SH - 190, width: 5, height: 190,
            transform: 'translateZ(-162px)',
            background: 'linear-gradient(90deg, #374151 0%, #4b5563 100%)',
            pointerEvents: 'none',
          }} />
          {/* IV bag */}
          <div
            style={{
              position: 'absolute',
              left: 58, top: SH - 212, width: 48, height: 30,
              transform: 'translateZ(-162px)',
              background: hasAccess ? '#1e3a5f' : '#0f172a',
              border: `1.5px solid ${hasAccess ? '#3b82f6' : '#1e293b'}`,
              borderRadius: 4,
              boxShadow: hasAccess ? '0 0 10px #3b82f630' : 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
            }}
            onClick={e => {
              e.stopPropagation();
              setMenu({ targetId: 'iv_station', title: 'Vascular Access', items: ivMenu(), anchor: anchor(e) });
            }}
          >
            <span style={{ color: hasAccess ? '#60a5fa' : '#374151', fontSize: 7, fontFamily: 'monospace', fontWeight: 'bold' }}>
              IV/IO
            </span>
            <span style={{ color: hasAccess ? '#93c5fd' : '#1e293b', fontSize: 6, fontFamily: 'monospace' }}>
              {hasAccess ? '✓ ON' : 'CLICK'}
            </span>
          </div>
          {/* IV tubing line */}
          <div style={{
            position: 'absolute',
            left: 82, top: SH - 183, width: 2, height: 180,
            transform: 'translateZ(-162px)',
            background: 'linear-gradient(180deg, #1e40af88 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          {/* ╔══════════════════════════════════════════════════════╗
              ║  DEFIB MONITOR  (right wall, x=842..900, z≈-278..-348) ║
              ╚══════════════════════════════════════════════════════╝ */}

          {/* Defib stand body (near face at z=DF_Z, facing viewer) */}
          <div style={{
            position: 'absolute',
            left: SW - DF_DEPTH, top: SH - DF_H,
            width: DF_DEPTH, height: DF_H,
            transform: `translateZ(${DF_Z}px)`,
            background: 'linear-gradient(180deg, #111827 0%, #1f2937 100%)',
            borderTop: '2px solid #4b5563',
            borderLeft: '2px solid #374151',
            pointerEvents: 'none',
          }}>
            {/* Stand column indicator (decorative) */}
            <div style={{
              position: 'absolute',
              left: '45%', bottom: 0, width: 8,
              height: '45%',
              background: '#374151',
              borderRadius: 2,
            }} />
            {/* Pad hook (decorative) */}
            <div style={{
              position: 'absolute', top: '12%', left: '20%',
              width: '60%', height: 6,
              background: '#374151',
              borderRadius: 2,
            }} />
          </div>

          {/* Defib — monitor face (at x=SW-DF_DEPTH, facing room) */}
          {/* Pivot at left edge so face sits at x=SW-DF_DEPTH after rotateY(90°) */}
          <div
            style={{
              position: 'absolute',
              left: SW - DF_DEPTH, top: SH - DF_H,
              width: DF_ZW,
              height: DF_H,
              transformOrigin: 'left center',
              transform: `translateZ(${DF_Z}px) rotateY(90deg)`,
              background: `linear-gradient(180deg, #0d1117 0%, #111827 100%)`,
              border: `2px solid ${ui.defibCharged ? '#d97706' : isShockable ? '#dc2626' : '#374151'}`,
              borderRadius: 3,
              boxShadow: ui.defibCharged
                ? '0 0 30px #d9770650, inset 0 0 20px #d9770618'
                : isShockable
                  ? '0 0 18px #dc262630'
                  : 'none',
              cursor: 'pointer',
              pointerEvents: 'auto',
              overflow: 'hidden',
            }}
            onClick={e => {
              e.stopPropagation();
              setMenu({ targetId: 'defib_station', title: 'Monitor / Defib', items: defibMenu(), anchor: anchor(e) });
            }}
          >
            {/* Header bar */}
            <div style={{
              background: ui.defibCharged ? '#78350f' : '#0f172a',
              borderBottom: `1px solid ${ui.defibCharged ? '#d97706' : '#1f2937'}`,
              padding: '3px 6px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: '#6b7280', fontSize: 7, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                MONITOR
              </span>
              <span style={{
                color: ui.defibCharged ? '#fbbf24' : isShockable ? '#f87171' : '#374151',
                fontSize: 7, fontFamily: 'monospace', fontWeight: 'bold',
              }}>
                {ui.defibCharged ? '⚡200J' : isShockable ? 'VF/VT' : 'NSR'}
              </span>
            </div>

            {/* ECG screen */}
            <div style={{
              margin: '6px 8px 4px',
              height: 40,
              background: '#04060e',
              border: '1px solid #1e293b',
              borderRadius: 2, overflow: 'hidden', padding: '4px 5px',
            }}>
              <svg viewBox="0 0 160 40" style={{ width: '100%', height: '100%' }}>
                <path
                  d={ecgPath()}
                  stroke={isShockable ? '#ef4444' : ui.rhythm === 'asystole' ? '#374151' : '#22c55e'}
                  strokeWidth="1.5" fill="none"
                />
              </svg>
            </div>

            {/* Vital readouts */}
            <div style={{ display: 'flex', gap: 4, margin: '0 8px 4px' }}>
              {[
                { label: 'HR', value: isArrest ? '---' : '72', color: '#22c55e' },
                { label: 'SpO2', value: isArrest ? '---' : '98', color: '#3b82f6' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  flex: 1, background: '#060c16',
                  border: '1px solid #1e293b', borderRadius: 2, padding: '2px 4px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <span style={{ color: '#4b5563', fontSize: 6, fontFamily: 'monospace' }}>{label}</span>
                  <span style={{ color, fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Rhythm label */}
            <div style={{ margin: '0 8px 4px', textAlign: 'center' }}>
              <span style={{
                color: isShockable ? '#f87171' : '#4b5563',
                fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.08em',
              }}>
                {isShockable ? '■ SHOCKABLE' : ui.rhythm === 'asystole' ? '— ASYSTOLE' : ui.rhythm === 'pea' ? '~ PEA' : 'ROSC'}
              </span>
            </div>

            {/* Shock count + button area */}
            <div style={{
              margin: '0 8px',
              padding: '4px 6px',
              background: ui.defibCharged ? '#7c2d12' : '#060c18',
              border: `1px solid ${ui.defibCharged ? '#d97706' : '#1e293b'}`,
              borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ color: '#374151', fontSize: 7, fontFamily: 'monospace' }}>
                Shocks: {ui.shockCount}
              </span>
              <span style={{
                color: ui.defibCharged ? '#fcd34d' : '#374151',
                fontSize: 7, fontFamily: 'monospace', fontWeight: 'bold',
              }}>
                {ui.defibCharged ? 'CHARGED' : 'STANDBY'}
              </span>
            </div>

            {/* Paddle connector ports */}
            <div style={{
              position: 'absolute', bottom: 6, left: 8, right: 8,
              display: 'flex', justifyContent: 'space-between',
            }}>
              {[0, 1].map(i => (
                <div key={i} style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#1f2937',
                  border: `2px solid ${ui.defibCharged ? '#d97706' : '#374151'}`,
                }} />
              ))}
            </div>
          </div>

          {/* Defib — top surface (horizontal) */}
          <div style={{
            position: 'absolute',
            left: SW - DF_DEPTH, top: SH - DF_H,
            width: DF_DEPTH, height: DF_ZW,
            transformOrigin: 'center top',
            transform: `translateZ(${DF_Z}px) rotateX(-90deg)`,
            background: 'linear-gradient(to bottom, #1f2937 0%, #111827 100%)',
            borderLeft: '1px solid #374151',
            borderRight: '1px solid #374151',
            pointerEvents: 'none',
          }} />

          {/* ╔═══════════════════════════════════════════════════════╗
              ║  PATIENT BED  (floor centre, z = BED_FZ .. BED_FZ-BED_L) ║
              ╚═══════════════════════════════════════════════════════╝ */}

          {/* Left side rail — top surface (thin horizontal strip along left side) */}
          <div style={{
            position: 'absolute',
            left: BED_CX - BED_W / 2,
            top: SH - BED_FH - BED_RH,
            width: 10,
            height: BED_L,
            transformOrigin: 'center top',
            transform: `translateZ(${BED_FZ}px) rotateX(-90deg)`,
            background: 'linear-gradient(90deg, #6b7280 0%, #9ca3af 50%, #6b7280 100%)',
            borderRadius: 2,
            pointerEvents: 'none',
          }} />

          {/* Right side rail — top surface */}
          <div style={{
            position: 'absolute',
            left: BED_CX + BED_W / 2 - 10,
            top: SH - BED_FH - BED_RH,
            width: 10,
            height: BED_L,
            transformOrigin: 'center top',
            transform: `translateZ(${BED_FZ}px) rotateX(-90deg)`,
            background: 'linear-gradient(90deg, #6b7280 0%, #9ca3af 50%, #6b7280 100%)',
            borderRadius: 2,
            pointerEvents: 'none',
          }} />

          {/* Mattress — main horizontal surface */}
          <div style={{
            position: 'absolute',
            left: BED_CX - BED_W / 2 + 10,
            top: SH - BED_FH,
            width: BED_W - 20,
            height: BED_L,
            transformOrigin: 'center top',
            transform: `translateZ(${BED_FZ}px) rotateX(-90deg)`,
            background: ui.cprActive
              ? 'linear-gradient(to bottom, #1e3a6e 0%, #1a2f58 50%, #1e3a6e 100%)'
              : 'linear-gradient(to bottom, #d1d9e6 0%, #bcc8d8 50%, #c8d4e4 100%)',
            borderLeft: '1px solid #94a3b8',
            borderRight: '1px solid #94a3b8',
            pointerEvents: 'none',
          }}>
            {/* Pillow at head of bed (appears at FAR end = large y-offset in div) */}
            <div style={{
              position: 'absolute',
              bottom: 8, left: '20%', width: '60%', height: 32,
              background: '#f1f5f9',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              opacity: 0.85,
            }} />
            {/* Sheet crease lines */}
            {[0.25, 0.5, 0.75].map(t => (
              <div key={t} style={{
                position: 'absolute',
                top: `${t * 100}%`,
                left: '10%', right: '10%',
                height: 1,
                background: 'rgba(148,163,184,0.3)',
              }} />
            ))}
          </div>

          {/* Footboard — vertical face, near viewer, CLICKABLE */}
          <div
            style={{
              position: 'absolute',
              left: BED_CX - BED_W / 2,
              top: SH - BED_FH,
              width: BED_W, height: BED_FH,
              transform: `translateZ(${BED_FZ}px)`,
              background: ui.cprActive
                ? 'linear-gradient(180deg, #2d3748 0%, #1f2937 100%)'
                : 'linear-gradient(180deg, #374151 0%, #1f2937 100%)',
              border: `2px solid ${ui.cprActive ? '#ef4444' : '#4b5563'}`,
              borderBottom: '3px solid #111827',
              borderRadius: '2px 2px 0 0',
              boxShadow: ui.cprActive
                ? 'inset 0 0 28px rgba(239,68,68,0.25), 0 4px 20px rgba(239,68,68,0.2)'
                : '0 4px 12px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
            }}
            onClick={e => {
              e.stopPropagation();
              setMenu({ targetId: 'patient_bed', title: 'Patient Bed', items: patientMenu(), anchor: anchor(e) });
            }}
          >
            {/* Metal crossbar (decorative) */}
            <div style={{
              width: '85%', height: 3,
              background: 'linear-gradient(90deg, #4b5563, #9ca3af, #4b5563)',
              borderRadius: 2, marginBottom: 2,
            }} />
            <motion.div
              animate={ui.cprActive ? { opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              style={{
                color: ui.cprActive ? '#fca5a5' : !isArrest ? '#86efac' : '#93c5fd',
                fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace',
                letterSpacing: '0.08em',
              }}
            >
              {ui.cprActive ? '❤ CPR ACTIVE' : !isArrest ? '✓ ROSC' : 'PATIENT BED'}
            </motion.div>
            <div style={{ color: '#374151', fontSize: 7, fontFamily: 'monospace' }}>
              click to manage
            </div>
          </div>

          {/* Headboard — small vertical face at far end of bed */}
          <div style={{
            position: 'absolute',
            left: BED_CX - BED_W / 2,
            top: SH - BED_FH,
            width: BED_W, height: BED_FH,
            transform: `translateZ(${BED_FZ - BED_L}px)`,
            background: 'linear-gradient(180deg, #374151 0%, #1f2937 100%)',
            border: '1px solid #374151',
            borderRadius: '2px 2px 0 0',
            pointerEvents: 'none',
          }} />

          {/* CPR pulse ring (3D, at foot of bed mattress) */}
          {ui.cprActive && (
            <motion.div
              style={{
                position: 'absolute',
                left: BED_CX - 32,
                top: SH - BED_FH - 32,
                width: 64, height: 64,
                border: '2px solid #ef4444',
                borderRadius: '50%',
                transform: `translateZ(${BED_FZ - 30}px)`,
                pointerEvents: 'none',
              }}
              animate={{ scale: [1, 1.7, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 0.55, repeat: Infinity }}
            />
          )}

        </div>{/* end scene wrapper */}
      </div>{/* end perspective viewport */}


      {/* ══════════════════════════════════════════════════════════════
          2D PROJECTED OVERLAYS
          Team members rendered flat so Framer Motion can animate
          them without fighting preserve-3d.
      ═══════════════════════════════════════════════════════════════ */}

      {/* ── Coordinate overlay (same centred box as 3D scene) ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: SW, height: SH,
          marginLeft: -SW / 2,
          marginTop: -SH / 2,
          pointerEvents: 'none',
        }}
      >
        {/* ── Team members (sorted far→near for painter's algorithm) ── */}
        {[...ui.team]
          .sort((a, b) => (ROLE_3D[a.assignedRole]?.z ?? 0) - (ROLE_3D[b.assignedRole]?.z ?? 0))
          .map(m => {
            const pos3d   = ROLE_3D[m.assignedRole] ?? ROLE_3D.none;
            const proj    = project(pos3d.x, pos3d.z);
            const sz      = Math.round(AVATAR_R * 2 * proj.s);
            const isFatigued = m.fatigueLevel > 0.5;
            const isCpr      = m.assignedRole === 'compressor' && ui.cprActive;
            const hasSpeech  = !!m.speech && ui.clock < m.speech.until;
            const zIndex     = Math.max(1, Math.round(100 + pos3d.z / 5));

            return (
              <motion.div
                key={m.id}
                style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'auto', zIndex }}
                initial={{ x: proj.x - AVATAR_R, y: proj.y - AVATAR_R }}
                animate={{ x: proj.x - AVATAR_R, y: proj.y - AVATAR_R }}
                transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
              >
                {/* Speech bubble */}
                <AnimatePresence>
                  {hasSpeech && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4 }}
                      style={{
                        position: 'absolute',
                        bottom: sz + 6,
                        left: '50%', transform: 'translateX(-50%)',
                        pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 30,
                      }}
                    >
                      <div style={{
                        background: '#1f2937', border: '1px solid #4b5563',
                        borderRadius: 4, padding: '3px 8px',
                        fontSize: Math.max(6, 9 * proj.s), color: '#e5e7eb',
                        maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {m.speech!.text}
                        <div style={{
                          position: 'absolute', top: '100%', left: '50%',
                          transform: 'translateX(-50%)',
                          borderLeft: '4px solid transparent',
                          borderRight: '4px solid transparent',
                          borderTop: '4px solid #4b5563',
                        }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Fatigue halo */}
                {m.assignedRole === 'compressor' && (
                  <motion.div
                    style={{
                      position: 'absolute',
                      width: sz, height: sz,
                      borderRadius: '50%',
                      boxShadow: `0 0 0 ${Math.max(2, 3 * proj.s)}px ${fatigueHaloColor(m.fatigueLevel)}, 0 0 ${12 * proj.s}px ${4 * proj.s}px ${fatigueHaloColor(m.fatigueLevel)}88`,
                      pointerEvents: 'none',
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
                      anchor: anchor(e),
                    });
                  }}
                  animate={
                    isCpr
                      ? { y: [0, -4 * proj.s, 0], scale: [1, 1.1, 1] }
                      : isFatigued
                        ? { scale: [1, 1.05, 1] }
                        : {}
                  }
                  transition={{ duration: isCpr ? 0.55 : 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  whileHover={{ scale: 1.2 }}
                  style={{
                    width: sz, height: sz,
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: Math.max(7, 10 * proj.s),
                    fontWeight: 'bold', fontFamily: 'monospace',
                    border: `${Math.max(1, 2 * proj.s)}px solid`,
                    cursor: 'pointer',
                    boxShadow: `0 ${3 * proj.s}px ${10 * proj.s}px rgba(0,0,0,0.6)`,
                    background:    m.isLeader   ? '#92400e'
                                 : isFatigued   ? '#7f1d1d'
                                 : m.confirmedRole ? '#14532d'
                                 : '#1f2937',
                    borderColor:   m.isLeader   ? '#fbbf24'
                                 : isFatigued   ? '#f87171'
                                 : m.confirmedRole ? '#4ade80'
                                 : '#6b7280',
                    color:         m.isLeader   ? '#fef3c7'
                                 : isFatigued   ? '#fecaca'
                                 : m.confirmedRole ? '#dcfce7'
                                 : '#d1d5db',
                  }}
                  title={`${m.name} — ${ROLE_FULL[m.assignedRole]}`}
                >
                  {m.name.split(' ')[0].slice(0, 3)}
                </motion.button>

                {/* Role badge */}
                {m.assignedRole !== 'none' && (
                  <div style={{ textAlign: 'center', marginTop: 3, pointerEvents: 'none' }}>
                    <span
                      className={`inline-flex items-center gap-0.5 px-1 py-px rounded border font-bold leading-none ${ROLE_BADGE_CLS[m.assignedRole]}`}
                      style={{ fontSize: Math.max(5, 7 * proj.s) }}
                    >
                      {m.confirmedRole && <span>✓</span>}
                      {ROLE_SHORT[m.assignedRole]}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}

      </div>{/* end scene coordinate overlay */}


      {/* ══════════════════════════════════════════════════════════════
          FLAT HUD OVERLAYS  (z ≥ 20, always on top)
      ═══════════════════════════════════════════════════════════════ */}

      {/* Defib charged warning strip */}
      <AnimatePresence>
        {ui.defibCharged && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: [1, 0.55, 1], y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-amber-900/85 border border-amber-400 rounded-lg px-4 py-1.5"
          >
            <span className="text-amber-200 text-xs font-bold font-mono tracking-wider">
              ⚡ DEFIB CHARGED 200J — STAND CLEAR
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Door / team actions (bottom centre) */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 cursor-pointer"
        style={{ pointerEvents: 'auto' }}
        onClick={e => {
          e.stopPropagation();
          setMenu({ targetId: 'door', title: 'Team Actions', items: doorMenu(), anchor: anchor(e) });
        }}
      >
        <div className="px-4 py-1.5 rounded border border-gray-700 bg-gray-900/70 text-[9px] text-gray-500 font-mono tracking-widest hover:border-gray-500 hover:text-gray-400 transition-colors backdrop-blur-sm">
          ▲ DOOR · TEAM ACTIONS
        </div>
      </div>

      {/* Chaos bar */}
      <div
        className="absolute z-20 flex flex-col items-center gap-0.5"
        style={{ bottom: '2.8rem', left: '50%', transform: 'translateX(-50%)', width: 200, pointerEvents: 'none' }}
      >
        <div className="flex items-center justify-between w-full px-0.5">
          <span className="text-[9px] text-gray-600 tracking-widest">CHAOS</span>
          <span className="text-[9px] text-gray-600">{ui.chaosFiredCount} events</span>
        </div>
        <div className="w-full h-1.5 bg-gray-900 border border-gray-800 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${chaosRatio > 0.7 ? 'bg-red-500' : chaosRatio > 0.4 ? 'bg-amber-500' : 'bg-green-600'}`}
            animate={{ width: `${Math.max(2, chaosRatio * 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Hint text */}
      <div className="absolute z-10 pointer-events-none" style={{ bottom: '5.2rem', left: '50%', transform: 'translateX(-50%)' }}>
        <span className="text-[8px] text-gray-700 tracking-wide">
          Click footboard · defib wall · crash cart · IV bag · airway cabinet · person · door
        </span>
      </div>

      {/* ── Context menu ── */}
      <AnimatePresence>
        {menu && (
          <>
            <div className="absolute inset-0 z-40" onClick={close} />
            <motion.div
              className="absolute z-50 bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-1.5 min-w-[160px] max-w-[210px]"
              style={{ left: `${clamp(menu.anchor.x, 5, 70)}%`, top: `${clamp(menu.anchor.y, 5, 65)}%` }}
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

    </div>
  );
}
