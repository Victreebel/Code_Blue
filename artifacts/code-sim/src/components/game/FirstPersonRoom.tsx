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

/* ── Menu types (identical interface to IsometricRoom) ─────────────── */
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

  /* Compute menu anchor from a click event relative to the container */
  function anchor(e: React.MouseEvent): { x: number; y: number } {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return { x: 30, y: 30 };
    const x = ((e.clientX - r.left) / r.width)  * 100;
    const y = ((e.clientY - r.top)  / r.height) * 100;
    return { x: clamp(x, 5, 72), y: clamp(y, 5, 65) };
  }

  /* ── Zone menus ── */
  function patientMenu(): MenuAction[] {
    return [
      { label: ui.cprActive ? 'CPR Running…' : 'Start CPR', variant: 'red',
        disabled: ui.cprActive, onSelect: () => act(actions.startCpr) },
      { label: 'Rotate Compressor', variant: 'gray', onSelect: () => act(actions.switchCompressor) },
      { label: 'Rhythm Check', variant: 'blue', onSelect: () => act(actions.rhythmCheck) },
      { label: 'Pulse Check',  variant: 'blue', onSelect: () => act(actions.pulseCheck) },
      ...(openOrder ? [{
        label: `CLC: "${openOrder.label.slice(0, 22)}${openOrder.label.length > 22 ? '…' : ''}"`,
        variant: 'amber' as const,
        onSelect: () => act(() => actions.requestClosedLoop(openOrder.id)),
      }] : []),
    ];
  }

  function defibMenu(): MenuAction[] {
    return [
      { label: ui.defibCharged ? 'CHARGED 200J' : 'Charge Defib 200J',
        variant: ui.defibCharged ? 'amberFilled' : 'amber',
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
      { label: 'Sodium Bicarb 1mEq/kg', variant: 'gray',
        onSelect: () => act(() => actions.medication('bicarb', 1)) },
    ];
  }

  function airwayMenu(): MenuAction[] {
    return [
      { label: ui.hasAdvancedAirway ? 'Advanced Airway ✓' : 'Intubate / Supraglottic',
        variant: 'gray', disabled: ui.hasAdvancedAirway,
        onSelect: () => act(actions.airwayAdvanced) },
      { label: 'BVM Ventilation', variant: 'gray', onSelect: () => act(actions.airwayBvm) },
    ];
  }

  function ivMenu(): MenuAction[] {
    return [
      { label: ui.hasIVAccess ? 'IV Access ✓' : 'Establish IV Access',
        variant: 'blue', disabled: ui.hasIVAccess,
        onSelect: () => act(actions.ivAccess) },
      { label: ui.hasIOAccess ? 'IO Access ✓' : 'Establish IO Access',
        variant: 'blue', disabled: ui.hasIOAccess,
        onSelect: () => act(actions.ioAccess) },
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
          The perspective is on this wrapper; the scene div inside is
          the 3D context (preserve-3d).  All room geometry lives here.
          Team members are rendered separately as a 2D projected overlay.
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

          {/* ── BACK WALL — Airway Station ── */}
          <div
            style={{
              position: 'absolute',
              width: SW, height: SH,
              top: 0, left: 0,
              transform: `translateZ(-${SD}px)`,
              background: 'linear-gradient(180deg, #06091a 0%, #080d1f 100%)',
              borderBottom: '2px solid #1e293b',
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            onClick={e => {
              e.stopPropagation();
              setMenu({ targetId: 'airway_station', title: 'Airway Equipment', items: airwayMenu(), anchor: anchor(e) });
            }}
          >
            {/* Airway equipment console */}
            <div style={{
              position: 'absolute',
              top: '12%', left: '50%',
              transform: 'translateX(-50%)',
              width: 280, height: 200,
              background: '#0b1020',
              border: `2px solid ${ui.hasAdvancedAirway ? '#22c55e' : '#f59e0b'}`,
              borderRadius: 6,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: `0 0 28px ${ui.hasAdvancedAirway ? '#22c55e38' : '#f59e0b28'}`,
            }}>
              {/* Vent waveform strip */}
              <div style={{
                width: '80%', height: 44,
                background: '#050a12',
                border: '1px solid #1f2937',
                borderRadius: 3, overflow: 'hidden',
                padding: '4px 8px',
              }}>
                <svg viewBox="0 0 200 30" style={{ width: '100%', height: '100%' }}>
                  <path
                    d="M0,15 L20,15 L24,3 L28,27 L32,3 L36,15 L70,15 L74,3 L78,27 L82,3 L86,15 L130,15 L134,3 L138,27 L142,3 L146,15 L200,15"
                    stroke={ui.hasAdvancedAirway ? '#22c55e' : '#f59e0b'}
                    strokeWidth="1.5" fill="none"
                  />
                </svg>
              </div>
              <div style={{ fontSize: 32 }}>🫁</div>
              <div style={{
                color: ui.hasAdvancedAirway ? '#86efac' : '#fcd34d',
                fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.1em',
              }}>
                AIRWAY {ui.hasAdvancedAirway ? '✓ SECURED' : '— CLICK TO MANAGE'}
              </div>
            </div>

            {/* Wall-mounted clock (decorative) */}
            <div style={{
              position: 'absolute', top: 10, right: 20,
              width: 48, height: 48, borderRadius: '50%',
              border: '2px solid #1e293b', background: '#060a14',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: '#374151', fontFamily: 'monospace',
            }}>
              🕐
            </div>

            {/* "HEAD OF BED" indicator */}
            <div style={{
              position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              color: '#1e3a5f', fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.15em',
            }}>
              ▲ HEAD OF BED
            </div>
          </div>

          {/* ── LEFT WALL — Medications ── */}
          <div
            style={{
              position: 'absolute',
              width: SD, height: SH,
              top: 0, left: 0,
              transformOrigin: '0% 50%',
              transform: 'rotateY(90deg)',
              background: 'linear-gradient(180deg, #06091a 0%, #07080d 100%)',
              pointerEvents: 'auto',
            }}
          >
            {/* Medication cart */}
            <div
              style={{
                position: 'absolute', top: '14%', left: '28%',
                width: 200, height: 210,
                background: '#080f0a',
                border: '2px solid #16a34a',
                borderRadius: 5,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 0 24px #16a34a28',
                cursor: 'pointer',
              }}
              onClick={e => {
                e.stopPropagation();
                setMenu({ targetId: 'medication_station', title: 'Medication Cart', items: medicationMenu(), anchor: anchor(e) });
              }}
            >
              <div style={{ fontSize: 30 }}>💊</div>
              <div style={{ color: '#86efac', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.09em' }}>
                MEDICATIONS
              </div>
              <div style={{ color: '#4b5563', fontSize: 9, fontFamily: 'monospace', textAlign: 'center', padding: '0 10px' }}>
                Epi · Amio · Bicarb
              </div>
            </div>

            {/* IV / IO access panel */}
            <div
              style={{
                position: 'absolute', bottom: '14%', left: '24%',
                width: 165, height: 100,
                background: '#060b14',
                border: `1.5px solid ${hasAccess ? '#3b82f6' : '#1e293b'}`,
                borderRadius: 4,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 5,
                boxShadow: hasAccess ? '0 0 14px #3b82f628' : 'none',
                cursor: 'pointer',
              }}
              onClick={e => {
                e.stopPropagation();
                setMenu({ targetId: 'iv_station', title: 'Vascular Access', items: ivMenu(), anchor: anchor(e) });
              }}
            >
              <div style={{ color: hasAccess ? '#93c5fd' : '#374151', fontSize: 11, fontWeight: 'bold', fontFamily: 'monospace' }}>
                IV / IO ACCESS {hasAccess ? '✓' : '—'}
              </div>
              {ui.hasIVAccess && <div style={{ color: '#60a5fa', fontSize: 8, fontFamily: 'monospace' }}>IV line established</div>}
              {ui.hasIOAccess && <div style={{ color: '#60a5fa', fontSize: 8, fontFamily: 'monospace' }}>IO access established</div>}
              {!hasAccess      && <div style={{ color: '#374151', fontSize: 8, fontFamily: 'monospace' }}>Click to establish</div>}
            </div>
          </div>

          {/* ── RIGHT WALL — Defib / Monitor ── */}
          <div
            style={{
              position: 'absolute',
              width: SD, height: SH,
              top: 0, right: 0,
              transformOrigin: '100% 50%',
              transform: 'rotateY(-90deg)',
              background: 'linear-gradient(180deg, #07050e 0%, #060408 100%)',
              pointerEvents: 'auto',
            }}
          >
            {/* Defib monitor unit */}
            <div
              style={{
                position: 'absolute', top: '8%', right: '22%',
                width: 215, height: 240,
                background: '#0d0508',
                border: `2px solid ${ui.defibCharged ? '#fbbf24' : isShockable ? '#ef4444' : '#4a1728'}`,
                borderRadius: 5,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: ui.defibCharged ? '0 0 40px #fbbf2450' : isShockable ? '0 0 24px #ef444430' : 'none',
                cursor: 'pointer',
              }}
              onClick={e => {
                e.stopPropagation();
                setMenu({ targetId: 'defib_station', title: 'Monitor / Defib', items: defibMenu(), anchor: anchor(e) });
              }}
            >
              {/* ECG screen */}
              <div style={{
                width: '82%', height: 58,
                background: '#04060e',
                border: '1px solid #1f2937',
                borderRadius: 3, overflow: 'hidden', padding: '4px 6px',
              }}>
                <svg viewBox="0 0 160 40" style={{ width: '100%', height: '100%' }}>
                  <path
                    d={ecgPath()}
                    stroke={isShockable ? '#ef4444' : ui.rhythm === 'asystole' ? '#374151' : '#22c55e'}
                    strokeWidth="1.5" fill="none"
                  />
                </svg>
              </div>

              {/* Rate readout */}
              <div style={{ color: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}>
                {isShockable ? 'SHOCKABLE' : ui.rhythm === 'pea' ? 'PEA' : ui.rhythm === 'asystole' ? 'ASYSTOLE' : 'RHYTHM OK'}
              </div>

              <div style={{ fontSize: 28 }}>⚡</div>

              <div style={{
                color: ui.defibCharged ? '#fbbf24' : isShockable ? '#fca5a5' : '#4b5563',
                fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.09em',
              }}>
                {ui.defibCharged ? '⚡ 200 J READY' : 'DEFIB'}
              </div>

              <div style={{ color: '#374151', fontSize: 9, fontFamily: 'monospace' }}>
                Shocks delivered: {ui.shockCount}
              </div>
            </div>
          </div>

        </div>{/* end scene wrapper */}
      </div>{/* end perspective viewport */}


      {/* ══════════════════════════════════════════════════════════════
          2D PROJECTED OVERLAYS
          Team members, patient bed label, and HUD — all rendered flat
          so Framer Motion can animate them without fighting preserve-3d.
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

        {/* ── Patient bed (projected floor element) ── */}
        {(() => {
          const bedZ = -240;
          const bedX = SW / 2;
          const proj = project(bedX, bedZ);
          const bedW = 190 * proj.s;
          const bedH =  60 * proj.s;
          return (
            <div
              style={{
                position: 'absolute',
                left: proj.x - bedW / 2,
                top:  proj.y - bedH / 2 + 14 * proj.s,
                width: bedW, height: bedH,
                border: `${Math.max(1, 2 * proj.s)}px solid ${ui.cprActive ? '#ef4444' : '#3b82f6'}`,
                borderRadius: 4 * proj.s,
                background: ui.cprActive ? 'rgba(127,29,29,0.5)' : 'rgba(14,30,48,0.5)',
                backdropFilter: 'blur(2px)',
                boxShadow: ui.cprActive ? `0 0 ${20 * proj.s}px #ef444440` : `0 0 ${14 * proj.s}px #3b82f630`,
                pointerEvents: 'auto',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                gap: 2,
                zIndex: 8,
              }}
              onClick={e => {
                e.stopPropagation();
                setMenu({ targetId: 'patient_bed', title: 'Patient Bed', items: patientMenu(), anchor: anchor(e) });
              }}
            >
              <motion.div
                animate={ui.cprActive ? { opacity: [1, 0.6, 1] } : {}}
                transition={{ duration: 0.55, repeat: Infinity }}
                style={{
                  color: ui.cprActive ? '#fca5a5' : !isArrest ? '#86efac' : '#93c5fd',
                  fontSize: Math.max(8, 13 * proj.s), fontWeight: 'bold', fontFamily: 'monospace',
                  letterSpacing: '0.06em',
                }}
              >
                {ui.cprActive ? '❤ CPR IN PROGRESS' : !isArrest ? '✓ ROSC' : 'PATIENT BED'}
              </motion.div>
            </div>
          );
        })()}

        {/* CPR pulse ring */}
        {ui.cprActive && (() => {
          const proj = project(SW / 2, -240);
          return (
            <motion.div
              style={{
                position: 'absolute',
                left: proj.x - 40, top: proj.y - 20,
                width: 80, height: 40,
                border: '2px solid #ef4444',
                borderRadius: '50%',
                pointerEvents: 'none', zIndex: 7,
              }}
              animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          );
        })()}

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
          Click patient bed · defib wall · meds wall · airway wall · person · door
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
