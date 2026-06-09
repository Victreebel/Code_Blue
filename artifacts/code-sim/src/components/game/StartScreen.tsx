import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useClerk, Show } from '@clerk/react';
import { useLocation } from 'wouter';
import { useGetSimulationHistory } from '@workspace/api-client-react';
import type { SimulationRunSummary } from '@workspace/api-client-react';

interface StartScreenProps {
  onStart: (seed?: string) => void;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatRunDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function outcomeLabel(outcome: string | null | undefined): string {
  if (!outcome) return '—';
  if (outcome === 'rosc') return 'ROSC';
  if (outcome === 'time_of_death') return 'TOD';
  return outcome;
}

function outcomeColor(outcome: string | null | undefined): string {
  if (outcome === 'rosc') return 'text-green-400';
  if (outcome === 'time_of_death') return 'text-red-400';
  return 'text-gray-400';
}

function HistoryPanel() {
  const { data: runs, isLoading, isError } = useGetSimulationHistory();
  const [expanded, setExpanded] = useState(false);

  const displayRuns = runs ?? [];
  const visibleRuns = expanded ? displayRuns : displayRuns.slice(0, 5);

  return (
    <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-400 tracking-wider">MY HISTORY</h3>
        {displayRuns.length > 0 && (
          <span className="text-[10px] font-mono text-gray-600">{displayRuns.length} run{displayRuns.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {isLoading && (
        <div className="text-[11px] text-gray-600 font-mono py-2">Loading history…</div>
      )}

      {isError && (
        <div className="text-[11px] text-red-500/70 font-mono py-2">Could not load history</div>
      )}

      {!isLoading && !isError && displayRuns.length === 0 && (
        <div className="text-[11px] text-gray-600 py-2">No runs yet. Complete a simulation to record it here.</div>
      )}

      {!isLoading && !isError && displayRuns.length > 0 && (
        <>
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {visibleRuns.map((run: SimulationRunSummary) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center justify-between bg-black/20 rounded px-2 py-1.5 border border-gray-800/50"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="text-[11px] text-gray-400 font-mono truncate">{run.scenario}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">{formatRunDate(run.runAt)}{run.seed ? ` · seed: ${run.seed}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[11px] font-mono font-bold ${outcomeColor(run.outcome)}`}>
                      {outcomeLabel(run.outcome)}
                    </span>
                    <span className="text-[11px] font-mono text-amber-300">
                      {run.score != null ? `${run.score}/100` : '—'}
                    </span>
                    <span className="text-[10px] font-mono text-gray-600">
                      {formatDuration(run.durationSeconds)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {displayRuns.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-[10px] font-mono text-gray-600 hover:text-gray-400 transition-colors"
            >
              {expanded ? 'Show less' : `Show ${displayRuns.length - 5} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function AccountBar() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
      <Show when="signed-in">
        <span className="text-[11px] text-gray-500 font-mono">{user?.primaryEmailAddress?.emailAddress}</span>
        <button
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          className="text-[11px] font-mono text-gray-600 hover:text-gray-400 border border-gray-800 px-2 py-1 rounded transition-colors"
        >
          Sign out
        </button>
      </Show>
      <Show when="signed-out">
        <button
          onClick={() => setLocation("/sign-in")}
          className="text-[11px] font-mono text-gray-600 hover:text-gray-400 border border-gray-800 px-2 py-1 rounded transition-colors"
        >
          Sign in
        </button>
      </Show>
    </div>
  );
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const [seed, setSeed] = useState('');
  const { isSignedIn } = useUser();

  return (
    <div className="relative min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <AccountBar />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-lg w-full"
      >
        <div className="text-center mb-10">
          <motion.div
            className="inline-flex items-center gap-2 mb-4"
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-red-400 text-sm font-bold tracking-[0.3em]">CODE BLUE</span>
            <div className="w-3 h-3 rounded-full bg-red-500" />
          </motion.div>
          <h1 className="text-4xl font-bold text-gray-100 mb-2">ACLS Code Simulator</h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Lead a witnessed cardiac arrest. Direct your team, follow ACLS protocol, and bring order to chaos.
          </p>
        </div>

        <div
          role="note"
          aria-label="Educational disclaimer"
          className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-4 mb-6"
        >
          <div className="text-[10px] font-bold tracking-[0.2em] text-amber-300 mb-1">
            EDUCATIONAL USE ONLY
          </div>
          <p className="text-[11px] text-amber-100/90 leading-relaxed">
            This is a training and learning simulation. It is <span className="font-bold">not</span>{' '}
            a medical device, is not a substitute for professional ACLS certification or clinical
            judgment, and must not be used to direct real patient care. Clinical thresholds,
            timings, and outcomes are simplified for teaching and may differ from current AHA
            guidelines. By continuing you acknowledge this is a simulation only.
          </p>
        </div>

        <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-5 mb-6">
          <h3 className="text-xs font-bold text-gray-300 mb-2 tracking-wider">SCENARIO</h3>
          <div className="text-sm text-gray-200 font-bold mb-1">Witnessed VF Arrest — Bed 4</div>
          <div className="text-xs text-gray-500 leading-relaxed">
            58 yo M, prior MI, on heparin for chest pain. Bedside RN witnesses sudden collapse.
            Telemetry shows ventricular fibrillation. You are the code leader. The team is converging.
          </div>
          <div className="mt-3 text-[11px] text-gray-500">
            Real-time, 5–8 minutes. One scenario. Two scripted chaos events: compressor fatigue,
            medication delay.
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs font-bold text-gray-500 tracking-wider mb-2 block">SEED (optional, for reproducible runs)</label>
          <input
            value={seed}
            onChange={e => setSeed(e.target.value)}
            placeholder="e.g. case-001"
            className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-700"
          />
        </div>

        <motion.button
          onClick={() => onStart(seed.trim() || undefined)}
          className="w-full py-3 rounded-lg bg-red-700 text-white font-bold text-sm hover:bg-red-600 transition-colors tracking-wider"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          RUN CODE
        </motion.button>

        {isSignedIn ? (
          <HistoryPanel />
        ) : (
          <div className="bg-gray-900/40 rounded-lg border border-gray-800/50 p-4 mt-4 text-center">
            <p className="text-[11px] text-gray-600">
              Sign in to save your simulation history and track improvement over time.
            </p>
          </div>
        )}

        <div className="mt-4 bg-gray-900/60 rounded-lg border border-gray-800 p-4">
          <h3 className="text-xs font-bold text-gray-400 mb-2">HOW TO PLAY</h3>
          <ul className="space-y-1.5 text-[11px] text-gray-500">
            <li>You are the <span className="text-gray-300">code team leader</span> — give orders, don't perform tasks yourself</li>
            <li><span className="text-gray-300">Assign roles</span> to team members and confirm their acknowledgment</li>
            <li>Follow <span className="text-gray-300">ACLS protocol</span> — rhythm checks every 2 min, epi every 3-5 min</li>
            <li><span className="text-gray-300">Charge the defibrillator</span> before delivering a shock</li>
            <li><span className="text-gray-300">Switch compressors</span> every 2 minutes to maintain CPR quality</li>
            <li>Use <span className="text-gray-300">closed-loop confirmation</span> when an order needs verification</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
