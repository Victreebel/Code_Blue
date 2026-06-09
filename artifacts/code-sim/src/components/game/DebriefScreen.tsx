import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@clerk/react';
import type { UIState } from '../../engine/ui/uiStateEngine';
import type { ScenarioInput } from '../../engine/types/scenario';
import { formatTime } from '../../engine/types/core';
import ReplayTimeline from './ReplayTimeline';
import { saveSimulationRun } from '@workspace/api-client-react';

interface DebriefScreenProps {
  ui: UIState;
  scenarioInput: ScenarioInput;
  onNewGame: () => void;
}

export default function DebriefScreen({ ui, scenarioInput, onNewGame }: DebriefScreenProps) {
  const score = ui.scoreReport;
  const { isSignedIn } = useAuth();
  const savedRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!isSignedIn || savedRef.current) return;
    savedRef.current = true;

    setSaveStatus('saving');

    const scenarioLabel = `${scenarioInput.patientName} — ${scenarioInput.chiefComplaint}`;
    const durationSeconds = Math.round(ui.clock / 10);

    const scoreData = score
      ? {
          total: score.total,
          buckets: score.buckets.map((b) => ({
            id: b.id,
            label: b.label,
            max: b.max,
            awarded: b.awarded,
            arithmetic: b.arithmetic,
            reasons: b.reasons,
          })),
          strengths: score.strengths,
          misses: score.misses,
          teachingPoints: score.teachingPoints,
        }
      : undefined;

    saveSimulationRun({
      scenario: scenarioLabel,
      seed: scenarioInput.seed ?? null,
      outcome: ui.outcome ?? null,
      score: score?.total ?? null,
      durationSeconds,
      scoreData: scoreData ?? null,
    })
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('error'));
  }, [isSignedIn, score, scenarioInput, ui.clock, ui.outcome]);

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-blue-400 text-xs font-bold tracking-[0.3em]">DEBRIEF</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-100">{scenarioInput.patientName} — {scenarioInput.chiefComplaint}</h1>
          <div className="text-xs text-gray-500 mt-1">
            Outcome: <span className="text-amber-300">{ui.outcome ?? 'incomplete'}</span> • Code time: {formatTime(ui.clock)} • Seed: {scenarioInput.seed}
          </div>
          {isSignedIn && (
            <div className="mt-2 text-[10px] font-mono">
              {saveStatus === 'saving' && <span className="text-gray-500">Saving run to history…</span>}
              {saveStatus === 'saved' && <span className="text-green-500">✓ Run saved to history</span>}
              {saveStatus === 'error' && <span className="text-red-500">Could not save to history</span>}
            </div>
          )}
          {!isSignedIn && (
            <div className="mt-2 text-[10px] font-mono text-gray-600">
              Sign in to save this run to your history
            </div>
          )}
        </div>

        {score && (
          <div className="bg-gray-900/70 rounded-lg border border-gray-800 p-5 mb-4">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-200">Performance — Scheme E</h2>
              <div className="text-3xl font-mono font-bold text-amber-300">
                {score.total}<span className="text-gray-500 text-lg">/100</span>
              </div>
            </div>
            <div className="space-y-3">
              {score.buckets.map(b => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-black/30 border border-gray-800/70 rounded p-3"
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm font-bold text-gray-200">{b.label}</span>
                    <span className="font-mono text-amber-300">
                      {b.awarded}<span className="text-gray-500">/{b.max}</span>
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-gray-400 mb-1">{b.arithmetic}</div>
                  <ul className="text-[11px] text-gray-500 space-y-0.5">
                    {b.reasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                  <div className="mt-2 h-1 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-amber-400/80"
                      style={{ width: `${(b.awarded / b.max) * 100}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <ReplayTimeline events={ui.recentLog} team={ui.team} />

        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={onNewGame}
            className="px-6 py-2 rounded-lg bg-red-700 text-white font-bold text-sm hover:bg-red-600"
          >
            NEW CODE
          </button>
        </div>
      </div>
    </div>
  );
}
