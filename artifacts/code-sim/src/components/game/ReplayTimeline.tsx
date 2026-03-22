import { useState } from 'react';
import { type ActionLogEntry } from '../../engine/types';
import { formatTime } from '../../engine/gameReducer';
import { motion } from 'framer-motion';

interface ReplayTimelineProps {
  entries: ActionLogEntry[];
  totalTime: number;
}

type MarkerType = 'rhythm' | 'pulse' | 'shock' | 'medication' | 'cpr' | 'role' | 'complication' | 'rosc' | 'tod' | 'other';

interface TimelineMarker {
  time: number;
  label: string;
  details: string | null | undefined;
  markerType: MarkerType;
}

const MARKER_CONFIG: Record<MarkerType, { color: string; shape: string }> = {
  rhythm: { color: '#22c55e', shape: 'diamond' },
  pulse: { color: '#ec4899', shape: 'circle' },
  shock: { color: '#f59e0b', shape: 'triangle' },
  medication: { color: '#3b82f6', shape: 'circle' },
  cpr: { color: '#ef4444', shape: 'square' },
  role: { color: '#8b5cf6', shape: 'circle' },
  complication: { color: '#f97316', shape: 'triangle' },
  rosc: { color: '#10b981', shape: 'star' },
  tod: { color: '#dc2626', shape: 'cross' },
  other: { color: '#6b7280', shape: 'circle' },
};

function classifyEntry(entry: ActionLogEntry): MarkerType {
  const a = entry.action.toLowerCase();
  if (a.includes('rosc') || a.includes('return of spontaneous')) return 'rosc';
  if (a.includes('time of death')) return 'tod';
  if (a.includes('rhythm check') || a.includes('rhythm:')) return 'rhythm';
  if (a.includes('pulse check')) return 'pulse';
  if (a.includes('shock')) return 'shock';
  if (a.includes('epinephrine') || a.includes('amiodarone') || a.includes('lidocaine') || a.includes('medication')) return 'medication';
  if (a.includes('cpr') || a.includes('compression')) return 'cpr';
  if (a.includes('assigned') || a.includes('role') || a.includes('compressor switch')) return 'role';
  if (entry.category === 'complication') return 'complication';
  return 'other';
}

function MarkerShape({ type, x, y, size }: { type: MarkerType; x: number; y: number; size: number }) {
  const { color, shape } = MARKER_CONFIG[type];

  if (shape === 'diamond') {
    return (
      <rect
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        fill={color}
        transform={`rotate(45, ${x}, ${y})`}
      />
    );
  }
  if (shape === 'triangle') {
    const h = size * 0.866;
    return (
      <polygon
        points={`${x},${y - h / 2} ${x - size / 2},${y + h / 2} ${x + size / 2},${y + h / 2}`}
        fill={color}
      />
    );
  }
  if (shape === 'square') {
    return <rect x={x - size / 2} y={y - size / 2} width={size} height={size} fill={color} />;
  }
  if (shape === 'star') {
    return <circle cx={x} cy={y} r={size * 0.7} fill={color} stroke="white" strokeWidth="1" />;
  }
  if (shape === 'cross') {
    return (
      <g>
        <line x1={x - size / 2} y1={y - size / 2} x2={x + size / 2} y2={y + size / 2} stroke={color} strokeWidth="2" />
        <line x1={x + size / 2} y1={y - size / 2} x2={x - size / 2} y2={y + size / 2} stroke={color} strokeWidth="2" />
      </g>
    );
  }
  return <circle cx={x} cy={y} r={size / 2} fill={color} />;
}

export default function ReplayTimeline({ entries, totalTime }: ReplayTimelineProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState<MarkerType | 'all'>('all');

  const markers: TimelineMarker[] = entries
    .filter(e => e.category === 'command' || e.category === 'complication' || e.action.includes('ROSC') || e.action.includes('Time of death'))
    .map(e => ({
      time: e.time,
      label: e.action,
      details: e.details,
      markerType: classifyEntry(e),
    }));

  const filtered = filter === 'all' ? markers : markers.filter(m => m.markerType === filter);

  const svgWidth = 900;
  const svgHeight = 120;
  const padding = 40;
  const trackY = 60;
  const usableWidth = svgWidth - padding * 2;

  const maxTime = Math.max(totalTime, 60);

  const minuteMarks: number[] = [];
  for (let t = 0; t <= maxTime; t += 60) {
    minuteMarks.push(t);
  }

  const filterButtons: { id: MarkerType | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'rhythm', label: 'Rhythm' },
    { id: 'shock', label: 'Shocks' },
    { id: 'medication', label: 'Meds' },
    { id: 'cpr', label: 'CPR' },
    { id: 'complication', label: 'Events' },
    { id: 'pulse', label: 'Pulse' },
  ];

  return (
    <div>
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {filterButtons.map(btn => (
          <button
            key={btn.id}
            onClick={() => setFilter(btn.id)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              filter === btn.id
                ? 'bg-gray-700 text-white font-bold'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {btn.id !== 'all' && (
              <span
                className="inline-block w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: MARKER_CONFIG[btn.id as MarkerType]?.color }}
              />
            )}
            {btn.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" style={{ minWidth: 600 }}>
          <line x1={padding} y1={trackY} x2={svgWidth - padding} y2={trackY} stroke="rgba(255,255,255,0.1)" strokeWidth="2" />

          {minuteMarks.map(t => {
            const x = padding + (t / maxTime) * usableWidth;
            return (
              <g key={t}>
                <line x1={x} y1={trackY - 8} x2={x} y2={trackY + 8} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <text x={x} y={trackY + 22} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9">
                  {formatTime(t)}
                </text>
              </g>
            );
          })}

          {filtered.map((marker, i) => {
            const x = padding + (marker.time / maxTime) * usableWidth;
            const isHovered = hoveredIdx === i;
            const yOffset = (i % 2 === 0) ? -20 : -30;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <line
                  x1={x}
                  y1={trackY + yOffset + 12}
                  x2={x}
                  y2={trackY}
                  stroke={MARKER_CONFIG[marker.markerType].color}
                  strokeWidth="0.5"
                  opacity={0.4}
                />
                <MarkerShape
                  type={marker.markerType}
                  x={x}
                  y={trackY + yOffset + 6}
                  size={isHovered ? 8 : 6}
                />

                {isHovered && (
                  <g>
                    <rect
                      x={Math.min(x - 80, svgWidth - padding - 165)}
                      y={trackY + 30}
                      width="160"
                      height="38"
                      rx="4"
                      fill="rgba(0,0,0,0.9)"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="0.5"
                    />
                    <text
                      x={Math.min(x - 74, svgWidth - padding - 159)}
                      y={trackY + 44}
                      fill="white"
                      fontSize="8"
                      fontWeight="bold"
                    >
                      {formatTime(marker.time)} — {marker.label.slice(0, 35)}
                    </text>
                    {marker.details && (
                      <text
                        x={Math.min(x - 74, svgWidth - padding - 159)}
                        y={trackY + 58}
                        fill="rgba(255,255,255,0.6)"
                        fontSize="7"
                      >
                        {marker.details.slice(0, 45)}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {Object.entries(MARKER_CONFIG).filter(([key]) => key !== 'other').map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
            <span className="text-[9px] text-gray-500 capitalize">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
