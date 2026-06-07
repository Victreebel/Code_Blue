import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDevScore, type ScoringDelta } from '../../engine/useDevScore';
import type { ReplayState } from '../../engine/types/replay';
import type { ScenarioState } from '../../engine/types/scenario';
import type { ScoreBucketId } from '../../engine/types/score';

interface Props {
  replay: ReplayState;
  scenario: ScenarioState;
  clock: number;
}

const BUCKET_ORDER: ScoreBucketId[] = [
  'acls_timing',
  'cpr_continuity',
  'defib_med',
  'delegation_clc',
  'leadership_chaos',
];

const BUCKET_COLORS: Record<ScoreBucketId, string> = {
  acls_timing: '#60a5fa',
  cpr_continuity: '#34d399',
  defib_med: '#f59e0b',
  delegation_clc: '#a78bfa',
  leadership_chaos: '#f87171',
};

function formatClock(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface DeltaBadge {
  delta: ScoringDelta;
  key: string;
}

interface BucketRowProps {
  bucketId: ScoreBucketId;
  label: string;
  awarded: number;
  max: number;
  activeDelta: number | null;
}

function BucketRow({ bucketId, label, awarded, max, activeDelta }: BucketRowProps) {
  const color = BUCKET_COLORS[bucketId];
  const pct = max > 0 ? (awarded / max) * 100 : 0;

  return (
    <div className="relative" style={{ paddingRight: 4 }}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-gray-400 truncate" style={{ maxWidth: 120 }}>{label}</span>
        <span className="text-[9px] font-mono text-gray-300 ml-1 shrink-0">{awarded}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-700/60 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <AnimatePresence>
        {activeDelta !== null && (
          <motion.div
            key={`badge-${activeDelta}`}
            className="absolute right-0 top-0 pointer-events-none"
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: 1.2, y: -8 }}
            exit={{ opacity: 0, scale: 0.8, y: -20, transition: { duration: 0.5 } }}
            transition={{ duration: 0.3 }}
          >
            <span
              className="text-[10px] font-bold px-1 py-0.5 rounded"
              style={{
                color: activeDelta >= 0 ? '#4ade80' : '#f87171',
                backgroundColor: activeDelta >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                border: `1px solid ${activeDelta >= 0 ? '#4ade80' : '#f87171'}`,
              }}
            >
              {activeDelta >= 0 ? `+${activeDelta}` : activeDelta} {activeDelta >= 0 ? '🟢' : '🔴'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ScreenEdgeGlowProps {
  positive: boolean;
  trigger: number;
}

function ScreenEdgeGlow({ positive, trigger }: ScreenEdgeGlowProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!visible) return null;

  const color = positive ? 'rgba(74,222,128,0.22)' : 'rgba(248,113,113,0.22)';
  const border = positive ? 'rgba(74,222,128,0.55)' : 'rgba(248,113,113,0.55)';

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 99998,
        boxShadow: `inset 0 0 60px 20px ${color}`,
        border: `2px solid ${border}`,
      }}
    />
  );
}

export default function DevScorePanel({ replay, scenario, clock }: Props) {
  const devScore = useDevScore(replay, scenario, clock);
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const [activeBucketDeltas, setActiveBucketDeltas] = useState<Partial<Record<ScoreBucketId, number>>>({});
  const [glowTrigger, setGlowTrigger] = useState({ positive: true, n: 0 });
  const [pendingBadges, setPendingBadges] = useState<DeltaBadge[]>([]);

  const prevLogLengthRef = useRef(0);

  useEffect(() => {
    if (!devScore) return;
    const newEntries = devScore.log.slice(prevLogLengthRef.current);
    prevLogLengthRef.current = devScore.log.length;
    if (newEntries.length === 0) return;

    const anyPositive = newEntries.some(d => d.delta > 0);
    setGlowTrigger(g => ({ positive: anyPositive, n: g.n + 1 }));

    const newBucketDeltas: Partial<Record<ScoreBucketId, number>> = {};
    for (const d of newEntries) {
      newBucketDeltas[d.bucketId] = (newBucketDeltas[d.bucketId] ?? 0) + d.delta;
    }
    setActiveBucketDeltas(newBucketDeltas);

    const badges: DeltaBadge[] = newEntries.map(d => ({
      delta: d,
      key: d.id,
    }));
    setPendingBadges(badges);

    const clearTimer = setTimeout(() => {
      setActiveBucketDeltas({});
      setPendingBadges([]);
    }, 2000);
    return () => clearTimeout(clearTimer);
  }, [devScore?.log.length]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [devScore?.log.length]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    const rect = panelRef.current!.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    setPos({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y,
    });
  }

  function onPointerUp() {
    dragging.current = false;
  }

  const total = devScore?.current.total ?? 0;

  return (
    <>
      <ScreenEdgeGlow positive={glowTrigger.positive} trigger={glowTrigger.n} />

      <div
        ref={panelRef}
        className="fixed z-[9999] select-none"
        style={{ left: pos.x, top: pos.y, width: 240 }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="relative rounded-lg overflow-hidden bg-gray-950/95 border border-gray-700/80 backdrop-blur-sm shadow-2xl">

          {/* Header — drag handle */}
          <div
            className="flex items-center justify-between px-2.5 py-1.5 bg-gray-900/90 border-b border-gray-700/60 cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold tracking-widest text-amber-400/80">DEV</span>
              <span className="text-[9px] text-gray-500">SCORE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-gray-200 font-bold">{total}/100</span>
              <button
                className="text-[10px] text-gray-600 hover:text-gray-300 leading-none px-0.5"
                onPointerDown={e => e.stopPropagation()}
                onClick={() => setCollapsed(c => !c)}
              >
                {collapsed ? '▼' : '▲'}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                {/* Bucket rows */}
                <div className="px-2.5 pt-2 pb-1 space-y-2.5">
                  {devScore && BUCKET_ORDER.map(id => {
                    const bucket = devScore.current.buckets.find(b => b.id === id);
                    if (!bucket) return null;
                    const activeDelta = activeBucketDeltas[id] ?? null;
                    return (
                      <BucketRow
                        key={id}
                        bucketId={id}
                        label={bucket.label}
                        awarded={bucket.awarded}
                        max={bucket.max}
                        activeDelta={activeDelta}
                      />
                    );
                  })}
                  {!devScore && (
                    <div className="text-[9px] text-gray-600 italic py-1">Waiting for simulation events…</div>
                  )}
                </div>

                {/* Divider */}
                <div className="mx-2.5 border-t border-gray-800/60 my-1" />

                {/* Scrollable event log */}
                <div
                  ref={logRef}
                  className="overflow-y-auto px-2.5 pb-2"
                  style={{ maxHeight: 140 }}
                >
                  {(!devScore || devScore.log.length === 0) && (
                    <div className="text-[9px] text-gray-700 italic">No scoring events yet</div>
                  )}
                  {devScore && devScore.log.map(entry => (
                    <div key={entry.id} className="flex items-start gap-1 mb-0.5">
                      <span className="text-[8px] text-gray-600 font-mono shrink-0 pt-px">{formatClock(entry.clockTimestamp)}</span>
                      <span
                        className="text-[8px] font-bold shrink-0"
                        style={{ color: entry.delta >= 0 ? '#4ade80' : '#f87171' }}
                      >
                        {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                      </span>
                      <span className="text-[8px] text-gray-400 leading-tight">{entry.reason}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating delta badges — fly above the panel */}
        <AnimatePresence>
          {pendingBadges.map((badge, i) => (
            <motion.div
              key={badge.key}
              className="absolute pointer-events-none"
              style={{ left: '50%', bottom: '100%', transform: 'translateX(-50%)' }}
              initial={{ opacity: 0, y: 0, scale: 0.4 }}
              animate={{ opacity: 1, y: -30 - i * 28, scale: 1 }}
              exit={{ opacity: 0, y: -60 - i * 28, scale: 0.6, transition: { duration: 0.6, delay: 1.4 } }}
              transition={{ duration: 0.35 }}
            >
              <span
                className="text-sm font-extrabold px-2 py-0.5 rounded-full shadow-lg"
                style={{
                  color: badge.delta.delta >= 0 ? '#4ade80' : '#f87171',
                  backgroundColor: badge.delta.delta >= 0 ? 'rgba(20,40,20,0.92)' : 'rgba(40,20,20,0.92)',
                  border: `1.5px solid ${badge.delta.delta >= 0 ? '#4ade80' : '#f87171'}`,
                }}
              >
                {badge.delta.delta >= 0 ? `+${badge.delta.delta}` : badge.delta.delta} {badge.delta.delta >= 0 ? '🟢' : '🔴'}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
