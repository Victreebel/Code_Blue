import { useState, useRef, CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UIState } from '../../engine/ui/uiStateEngine';
import type { EngineActions } from '../../engine/useGameEngine';
import type { TeamMemberRuntime } from '../../engine/types/team';
import type { PendingOrder } from '../../engine/types/orders';
import { AMIODARONE_FIRST_DOSE_MG, AMIODARONE_SUBSEQUENT_DOSE_MG } from '../../engine/clinical/aclsConstants';

interface SpatialRoomCanvasProps {
  ui: UIState;
  actions: EngineActions;
}

type ZoneId = 'patient_bed' | 'defib_station' | 'medication_station' | 'airway_station';

const ZONE_ROLES: Record<ZoneId, string[]> = {
  patient_bed: ['compressor', 'recorder', 'timekeeper', 'leader', 'none'],
  airway_station: ['airway'],
  defib_station: ['monitor_defib'],
  medication_station: ['medication', 'iv_access'],
};

const ZONE_LABELS: Record<ZoneId, string> = {
  patient_bed: 'Patient Bed',
  defib_station: 'Defib Station',
  medication_station: 'Medication Station',
  airway_station: 'Airway Station',
};

const ZONE_COLORS: Record<ZoneId, { fill: string; stroke: string; label: string }> = {
  patient_bed: { fill: '#1e3a5f', stroke: '#3b82f6', label: '#93c5fd' },
  defib_station: { fill: '#3b1f1f', stroke: '#ef4444', label: '#fca5a5' },
  medication_station: { fill: '#1a2e1a', stroke: '#22c55e', label: '#86efac' },
  airway_station: { fill: '#2d2a1a', stroke: '#f59e0b', label: '#fcd34d' },
};

function isoTilePoints(cx: number, cy: number, w: number, h: number): string {
  return [
    `${cx},${cy - h / 2}`,
    `${cx + w / 2},${cy}`,
    `${cx},${cy + h / 2}`,
    `${cx - w / 2},${cy}`,
  ].join(' ');
}

function isoLeftWall(cx: number, cy: number, w: number, h: number, wallH: number): string {
  const topLeft = `${cx - w / 2},${cy}`;
  const bottomLeft = `${cx},${cy + h / 2}`;
  const bottomLeftDown = `${cx},${cy + h / 2 + wallH}`;
  const topLeftDown = `${cx - w / 2},${cy + wallH}`;
  return [topLeft, bottomLeft, bottomLeftDown, topLeftDown].join(' ');
}

function isoRightWall(cx: number, cy: number, w: number, h: number, wallH: number): string {
  const topRight = `${cx + w / 2},${cy}`;
  const bottomRight = `${cx},${cy + h / 2}`;
  const bottomRightDown = `${cx},${cy + h / 2 + wallH}`;
  const topRightDown = `${cx + w / 2},${cy + wallH}`;
  return [topRight, bottomRight, bottomRightDown, topRightDown].join(' ');
}

const ZONES: Array<{
  id: ZoneId;
  cx: number;
  cy: number;
  w: number;
  h: number;
  wallH: number;
}> = [
  { id: 'airway_station', cx: 190, cy: 68, w: 110, h: 55, wallH: 14 },
  { id: 'defib_station', cx: 300, cy: 108, w: 110, h: 55, wallH: 14 },
  { id: 'medication_station', cx: 80, cy: 108, w: 110, h: 55, wallH: 14 },
  { id: 'patient_bed', cx: 190, cy: 148, w: 130, h: 65, wallH: 18 },
];

const ZONE_AVATAR_OFFSET: Record<ZoneId, { dx: number; dy: number }> = {
  airway_station: { dx: 0, dy: -44 },
  defib_station: { dx: 48, dy: -8 },
  medication_station: { dx: -48, dy: -8 },
  patient_bed: { dx: 0, dy: 8 },
};

function getZoneForRole(role: string): ZoneId {
  for (const [zone, roles] of Object.entries(ZONE_ROLES)) {
    if (roles.includes(role)) return zone as ZoneId;
  }
  return 'patient_bed';
}

function statusLabel(status: string): { text: string; color: string } {
  switch (status) {
    case 'heard': return { text: 'Heard', color: 'bg-yellow-800/80 text-yellow-200' };
    case 'acknowledged': return { text: 'ACK', color: 'bg-blue-800/80 text-blue-200' };
    case 'in_progress': return { text: 'In Progress', color: 'bg-green-800/80 text-green-200' };
    case 'issued': return { text: 'Issued', color: 'bg-gray-700/80 text-gray-300' };
    default: return { text: status, color: 'bg-gray-700/80 text-gray-300' };
  }
}

const NON_TERMINAL = new Set(['issued', 'heard', 'acknowledged', 'in_progress']);

interface ZoneMenuProps {
  zone: ZoneId;
  ui: UIState;
  actions: EngineActions;
  onClose: () => void;
  anchorX: number;
  anchorY: number;
}

function ZoneMenu({ zone, ui, actions, onClose, anchorX, anchorY }: ZoneMenuProps) {
  const isShockable = ui.rhythm === 'vfib' || ui.rhythm === 'vtach';
  const hasAccess = ui.hasIVAccess || ui.hasIOAccess;
  const amioDose = ui.amiodaroneDoses === 0 ? AMIODARONE_FIRST_DOSE_MG : AMIODARONE_SUBSEQUENT_DOSE_MG;
  const openOrder = ui.pendingOrders.filter(o => NON_TERMINAL.has(o.status)).slice(-1)[0] ?? null;

  const btnBase = 'w-full text-left text-[11px] px-2 py-1.5 rounded font-semibold transition-colors';
  const btnEnabled = `${btnBase} bg-gray-700 hover:bg-gray-600 text-gray-100`;
  const btnDisabled = `${btnBase} bg-gray-900/40 text-gray-600 cursor-not-allowed`;
  const btnRed = `${btnBase} bg-red-900/70 hover:bg-red-800/80 text-red-200`;
  const btnAmber = `${btnBase} bg-amber-900/60 hover:bg-amber-800/70 text-amber-200`;
  const btnAmberFilled = `${btnBase} bg-amber-700 text-amber-50 cursor-default`;
  const btnBlue = `${btnBase} bg-blue-900/50 hover:bg-blue-800/60 text-blue-200`;

  const wrap = (fn: () => void) => () => { fn(); onClose(); };

  const menuStyle: CSSProperties = {
    position: 'absolute',
    left: anchorX,
    top: anchorY,
    transform: 'translate(-50%, -100%)',
    zIndex: 50,
    minWidth: 180,
  };

  const color = ZONE_COLORS[zone];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 4 }}
      transition={{ duration: 0.12 }}
      style={{ ...menuStyle, borderColor: color.stroke + '80' }}
      className="bg-gray-900 border rounded-lg shadow-2xl p-2 space-y-1"
    >
      <div
        className="text-[10px] font-bold tracking-wider mb-1.5 pb-1 border-b border-gray-700"
        style={{ color: color.label }}
      >
        {ZONE_LABELS[zone]}
      </div>

      {zone === 'patient_bed' && (
        <>
          <button
            onClick={wrap(actions.startCpr)}
            disabled={ui.cprActive}
            className={ui.cprActive ? btnDisabled : btnRed}
          >
            {ui.cprActive ? 'CPR running…' : 'Start CPR'}
          </button>
          <button
            onClick={wrap(actions.switchCompressor)}
            className={btnEnabled}
          >
            Rotate Compressor
          </button>
          <button onClick={wrap(actions.rhythmCheck)} className={btnBlue}>
            Rhythm Check
          </button>
          <button onClick={wrap(actions.pulseCheck)} className={btnBlue}>
            Pulse Check
          </button>
          {openOrder && (
            <button
              onClick={wrap(() => actions.requestClosedLoop(openOrder.id))}
              className={btnAmber}
            >
              Closed-loop: "{openOrder.label.slice(0, 22)}"
            </button>
          )}
        </>
      )}

      {zone === 'defib_station' && (
        <>
          <button
            onClick={wrap(actions.chargeDefib)}
            disabled={!isShockable || ui.defibCharged}
            className={ui.defibCharged ? btnAmberFilled : isShockable ? btnAmber : btnDisabled}
          >
            {ui.defibCharged ? 'CHARGED 200 J' : 'Charge Defib'}
          </button>
          <button
            onClick={wrap(actions.shock)}
            disabled={!ui.defibCharged}
            className={ui.defibCharged ? btnRed : btnDisabled}
          >
            Deliver SHOCK ({ui.shockCount})
          </button>
        </>
      )}

      {zone === 'medication_station' && (
        <>
          <button
            onClick={wrap(() => actions.medication('epinephrine', 1))}
            className={hasAccess ? btnBlue : btnAmber}
            title={hasAccess ? 'Epi 1mg IV/IO' : 'No vascular access'}
          >
            Epinephrine 1 mg{!hasAccess && ' ⚠'}
          </button>
          <button
            onClick={wrap(() => actions.medication('amiodarone', amioDose))}
            className={hasAccess ? btnBlue : btnAmber}
            title={hasAccess ? `Amiodarone ${amioDose}mg` : 'No vascular access'}
          >
            Amiodarone {amioDose} mg{!hasAccess && ' ⚠'}
          </button>
          {!hasAccess && (
            <p className="text-[9px] text-amber-400/80 px-1">
              ⚠ No IV/IO — assign access first
            </p>
          )}
        </>
      )}

      {zone === 'airway_station' && (
        <>
          <button onClick={wrap(actions.airwayBvm)} className={btnBlue}>
            BVM / Bag-Valve Mask
          </button>
          {!ui.hasAdvancedAirway && (
            <p className="text-[9px] text-gray-500 px-1">
              Advanced airway not yet placed
            </p>
          )}
          {ui.hasAdvancedAirway && (
            <p className="text-[9px] text-green-400 px-1">
              ✓ Advanced airway in place
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}

interface AvatarProps {
  member: TeamMemberRuntime;
  orders: PendingOrder[];
  x: number;
  y: number;
  cprActive: boolean;
  isPrimary: boolean;
}

function MemberAvatar({ member, orders, x, y, cprActive, isPrimary }: AvatarProps) {
  const activeOrders = orders.filter(
    o => o.targetMemberId === member.id && NON_TERMINAL.has(o.status)
  );
  const latestOrder = activeOrders.slice(-1)[0] ?? null;

  const isCpr = member.assignedRole === 'compressor' && cprActive;

  return (
    <g style={{ pointerEvents: 'none' }}>
      {isCpr && (
        <motion.circle
          cx={x}
          cy={y}
          r={16}
          fill="rgba(239,68,68,0.15)"
          stroke="#ef4444"
          strokeWidth={1.5}
          animate={{ r: [14, 18, 14] }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      )}
      <foreignObject
        x={x - 14}
        y={y - 14}
        width={28}
        height={28}
        style={{ overflow: 'visible' }}
      >
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-bold border-2 ${
            member.isLeader
              ? 'bg-amber-700 border-amber-300 text-amber-50'
              : member.confirmedRole
                ? 'bg-green-900 border-green-500 text-green-100'
                : 'bg-gray-800 border-gray-600 text-gray-300'
          }`}
        >
          {member.name.split(' ')[0].slice(0, 3)}
        </div>
      </foreignObject>
      <foreignObject
        x={x - 32}
        y={y + 15}
        width={64}
        height={24}
        style={{ overflow: 'visible' }}
      >
        <div className="text-center">
          <div className="text-[8px] text-gray-400 truncate leading-tight">
            {member.name.split(' ')[0]}
          </div>
        </div>
      </foreignObject>
      {latestOrder && (
        <foreignObject
          x={x + 10}
          y={y - 22}
          width={70}
          height={18}
          style={{ overflow: 'visible' }}
        >
          <div className={`text-[8px] px-1 py-0.5 rounded font-semibold leading-none whitespace-nowrap ${statusLabel(latestOrder.status).color}`}>
            {statusLabel(latestOrder.status).text}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

export default function SpatialRoomCanvas({ ui, actions }: SpatialRoomCanvasProps) {
  const [activeZone, setActiveZone] = useState<ZoneId | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleZoneClick = (zone: ZoneId, cx: number, cy: number) => {
    if (activeZone === zone) {
      setActiveZone(null);
      return;
    }
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const vbWidth = 380;
      const vbHeight = 240;
      const scaleX = rect.width / vbWidth;
      const scaleY = rect.height / vbHeight;
      setMenuAnchor({
        x: cx * scaleX,
        y: (cy - 30) * scaleY,
      });
    }
    setActiveZone(zone);
  };

  const membersByZone: Partial<Record<ZoneId, TeamMemberRuntime[]>> = {};
  for (const m of ui.team) {
    const zone = getZoneForRole(m.assignedRole);
    if (!membersByZone[zone]) membersByZone[zone] = [];
    membersByZone[zone]!.push(m);
  }

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-2 flex flex-col">
      <div className="text-[10px] text-gray-500 tracking-wider mb-1 flex items-center justify-between">
        <span>SPATIAL VIEW</span>
        {activeZone && (
          <button
            onClick={() => setActiveZone(null)}
            className="text-[9px] text-gray-600 hover:text-gray-400"
          >
            ✕ close
          </button>
        )}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox="0 0 380 240"
          className="w-full"
          style={{ display: 'block' }}
          onClick={(e) => {
            if ((e.target as SVGElement).closest('[data-zone]') === null) {
              setActiveZone(null);
            }
          }}
        >
          <defs>
            <filter id="glow-red">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Room floor background */}
          <rect x="0" y="0" width="380" height="240" fill="#030712" />

          {/* Render zones back-to-front */}
          {ZONES.map(({ id, cx, cy, w, h, wallH }) => {
            const color = ZONE_COLORS[id];
            const isActive = activeZone === id;
            const isCharged = id === 'defib_station' && ui.defibCharged;
            const isCprBed = id === 'patient_bed' && ui.cprActive;

            return (
              <g
                key={id}
                data-zone={id}
                onClick={() => handleZoneClick(id, cx, cy - h / 2)}
                style={{ cursor: 'pointer' }}
              >
                {/* Left wall */}
                <polygon
                  points={isoLeftWall(cx, cy, w, h, wallH)}
                  fill={color.fill}
                  fillOpacity={0.6}
                  stroke={isActive ? color.stroke : color.stroke + '50'}
                  strokeWidth={isActive ? 1.5 : 0.5}
                />
                {/* Right wall */}
                <polygon
                  points={isoRightWall(cx, cy, w, h, wallH)}
                  fill={color.fill}
                  fillOpacity={0.4}
                  stroke={isActive ? color.stroke : color.stroke + '50'}
                  strokeWidth={isActive ? 1.5 : 0.5}
                />
                {/* Top face */}
                <motion.polygon
                  points={isoTilePoints(cx, cy, w, h)}
                  fill={color.fill}
                  fillOpacity={isActive ? 0.95 : 0.75}
                  stroke={color.stroke}
                  strokeWidth={isActive ? 2 : 1}
                  animate={
                    isCprBed
                      ? { fillOpacity: [0.75, 0.95, 0.75] }
                      : isCharged
                        ? { stroke: [color.stroke, '#fbbf24', color.stroke] }
                        : {}
                  }
                  transition={{ duration: isCprBed ? 0.6 : 0.8, repeat: Infinity }}
                  filter={isCharged ? 'url(#glow-red)' : undefined}
                />
                {/* Zone label */}
                <text
                  x={cx}
                  y={cy - 2}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight="bold"
                  fill={color.label}
                  fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {ZONE_LABELS[id]}
                </text>
                {/* CPR indicator */}
                {isCprBed && (
                  <motion.text
                    x={cx}
                    y={cy + 12}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#ef4444"
                    fontFamily="monospace"
                    fontWeight="bold"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    ● CPR ACTIVE
                  </motion.text>
                )}
                {/* Charged indicator */}
                {isCharged && (
                  <motion.text
                    x={cx}
                    y={cy + 10}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#fbbf24"
                    fontFamily="monospace"
                    fontWeight="bold"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    ⚡ 200J READY
                  </motion.text>
                )}
                {/* Click hint */}
                {!isActive && (
                  <text
                    x={cx}
                    y={cy + (isCprBed || isCharged ? 22 : 12)}
                    textAnchor="middle"
                    fontSize={7}
                    fill={color.stroke + '70'}
                    fontFamily="monospace"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    tap to act
                  </text>
                )}
              </g>
            );
          })}

          {/* Team member avatars */}
          {ZONES.map(({ id, cx, cy }) => {
            const members = membersByZone[id] ?? [];
            const offset = ZONE_AVATAR_OFFSET[id];
            return members.map((m, i) => {
              const spread = members.length > 1 ? (i - (members.length - 1) / 2) * 22 : 0;
              return (
                <MemberAvatar
                  key={m.id}
                  member={m}
                  orders={ui.pendingOrders}
                  x={cx + offset.dx + spread}
                  y={cy + offset.dy}
                  cprActive={ui.cprActive}
                  isPrimary={i === 0}
                />
              );
            });
          })}

          {/* Legend */}
          <text x={8} y={230} fontSize={8} fill="#4b5563" fontFamily="monospace">
            Click a zone to see actions
          </text>
        </svg>

        {/* Zone action menu overlay */}
        <AnimatePresence>
          {activeZone && (
            <ZoneMenu
              key={activeZone}
              zone={activeZone}
              ui={ui}
              actions={actions}
              onClose={() => setActiveZone(null)}
              anchorX={menuAnchor.x}
              anchorY={menuAnchor.y}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
