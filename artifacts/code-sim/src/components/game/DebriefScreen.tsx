import { type GameState, type ActionLogEntry, RHYTHM_LABELS, REVERSIBLE_CAUSE_LABELS, FAILURE_DOMAIN_LABELS } from '../../engine/types';
import { formatTime } from '../../engine/gameReducer';
import { getGrade } from '../../engine/scoringEngine';
import ReplayTimeline from './ReplayTimeline';
import { motion } from 'framer-motion';

interface DebriefScreenProps {
  state: GameState;
  onNewGame: () => void;
}

function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className="mb-2 group relative">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300">{score}/{max}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

function RoomControlPanel({ breakdown }: { breakdown: NonNullable<GameState['debriefAnalysis']>['roomControlBreakdown'] }) {
  const items = [
    { label: 'Role Clarity', value: breakdown.roleClarity, tip: 'Were roles clearly assigned and confirmed?' },
    { label: 'Crowd Control', value: breakdown.crowdControl, tip: 'Was room overcrowding managed?' },
    { label: 'Assignment Follow-Through', value: breakdown.assignmentFollowThrough, tip: 'Did orders get completed?' },
    { label: 'Ambiguity Correction', value: breakdown.ambiguityCorrection, tip: 'Were unclear orders resolved?' },
    { label: 'Delay Recovery', value: breakdown.delayRecovery, tip: 'Were delays addressed and recovered from?' },
  ];

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.label} className="group relative">
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-gray-400">{item.label}</span>
            <span className="text-gray-300">{item.value}/10</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                item.value >= 7 ? 'bg-green-500' : item.value >= 4 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${item.value * 10}%` }}
            />
          </div>
          <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-800 text-[10px] text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {item.tip}
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightCard({ title, items, color }: { title: string; items: { description: string; impact: string }[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className={`text-xs font-bold tracking-wider ${color}`}>{title}</h3>
      {items.map((item, i) => (
        <div key={i} className="bg-gray-800/50 rounded-lg p-2.5">
          <div className="text-xs text-gray-200 font-medium">{item.description}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{item.impact}</div>
        </div>
      ))}
    </div>
  );
}

export default function DebriefScreen({ state, onNewGame }: DebriefScreenProps) {
  const { score, actionLog, scenario, patient, clock, debriefAnalysis } = state;
  const grade = getGrade(score.total);

  const commandActions = actionLog.filter(l => l.category === 'command');
  const complications = actionLog.filter(l => l.category === 'complication');
  const roscAchieved = actionLog.some(l => l.action.includes('ROSC'));
  const todCalled = actionLog.some(l => l.action.includes('Time of death'));

  const cprFractionPct = Math.round(state.compressionFraction * 100);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Code Debrief</h1>
          <p className="text-gray-400">
            Patient: {scenario?.patientName} | Duration: {formatTime(clock)} |{' '}
            {roscAchieved ? (
              <span className="text-green-400">ROSC Achieved</span>
            ) : todCalled ? (
              <span className="text-red-400">Time of Death Called</span>
            ) : (
              <span className="text-gray-500">Code Ended</span>
            )}
          </p>
        </motion.div>

        {debriefAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900 rounded-xl border border-gray-700 p-5 mb-6"
          >
            <h2 className="text-sm font-bold text-gray-300 tracking-wider mb-4">CLINICAL ANALYSIS</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">ROSC Achievable</div>
                <div className={`text-lg font-bold ${debriefAnalysis.roscInitiallyAchievable ? 'text-green-400' : 'text-gray-500'}`}>
                  {debriefAnalysis.roscInitiallyAchievable ? 'Yes' : 'No'}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Your Impact</div>
                <div className={`text-lg font-bold ${
                  debriefAnalysis.playerImpact === 'improved' ? 'text-green-400' :
                  debriefAnalysis.playerImpact === 'worsened' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {debriefAnalysis.playerImpact === 'improved' ? 'Improved Outcome' :
                   debriefAnalysis.playerImpact === 'worsened' ? 'Worsened Outcome' : 'Neutral Impact'}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Primary Issue</div>
                <div className="text-sm font-medium text-gray-200">
                  {debriefAnalysis.primaryFailureDomain
                    ? FAILURE_DOMAIN_LABELS[debriefAnalysis.primaryFailureDomain]
                    : roscAchieved ? 'Successful Resuscitation' : 'N/A'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InsightCard title="TOP MISTAKES" items={debriefAnalysis.topMistakes} color="text-red-400" />
              <InsightCard title="TOP STRENGTHS" items={debriefAnalysis.topStrengths} color="text-green-400" />
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gray-900 rounded-xl border border-gray-700 p-5 mb-6"
        >
          <h2 className="text-sm font-bold text-gray-300 tracking-wider mb-3">EVENT TIMELINE</h2>
          <ReplayTimeline entries={actionLog} totalTime={clock} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900 rounded-xl border border-gray-700 p-5"
          >
            <div className="text-center mb-4">
              <div className={`text-6xl font-bold ${grade.color}`}>{grade.letter}</div>
              <div className="text-lg text-gray-400 mt-1">{grade.label}</div>
              <div className="text-3xl font-mono text-gray-200 mt-2">{score.total}/100</div>
            </div>

            <div className="space-y-1">
              <ScoreBar label="Rhythm Check Timing" score={score.rhythmCheckTiming} max={12} color="bg-green-500" />
              <ScoreBar label="Epinephrine Timing" score={score.epinephrineTiming} max={12} color="bg-blue-500" />
              <ScoreBar label="Defibrillation" score={score.defibrillationTiming} max={12} color="bg-orange-500" />
              <ScoreBar label="Medication Choices" score={score.medicationChoices} max={8} color="bg-purple-500" />
              <ScoreBar label="Pulse Checks" score={score.pulseChecks} max={8} color="bg-pink-500" />
              <ScoreBar label="Closed-Loop Comm" score={score.closedLoopComm} max={12} color="bg-cyan-500" />
              <ScoreBar label="Team Management" score={score.teamManagement} max={12} color="bg-yellow-500" />
              <ScoreBar label="Reversible Causes" score={score.reversibleCauses} max={8} color="bg-rose-500" />
              <ScoreBar label="Leadership" score={score.overallLeadership} max={8} color="bg-indigo-500" />
              <ScoreBar label="Room Control" score={score.roomControl} max={10} color="bg-teal-500" />
              {score.penalties < 0 && (
                <div className="text-xs text-red-400 mt-2">Penalties: {score.penalties} pts</div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-gray-900 rounded-xl border border-gray-700 p-5"
          >
            <h2 className="text-sm font-bold text-gray-300 tracking-wider mb-3">SCENARIO DETAILS</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Initial Rhythm</span>
                <span>{scenario ? RHYTHM_LABELS[scenario.initialRhythm] : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reversible Cause</span>
                <span>{scenario ? REVERSIBLE_CAUSE_LABELS[scenario.reversibleCause] : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cause Identified</span>
                <span className={patient.reversibleCauseIdentified ? 'text-green-400' : 'text-red-400'}>
                  {patient.reversibleCauseIdentified ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cause Treated</span>
                <span className={patient.reversibleCauseTreated ? 'text-green-400' : 'text-red-400'}>
                  {patient.reversibleCauseTreated ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shocks Delivered</span>
                <span>{patient.shockCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Epi Doses</span>
                <span>{patient.medications.filter(m => m.type === 'epinephrine').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Rhythm Checks</span>
                <span>{state.rhythmChecksDone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Compression Fraction</span>
                <span className={cprFractionPct >= 60 ? 'text-green-400' : cprFractionPct >= 40 ? 'text-yellow-400' : 'text-red-400'}>
                  {cprFractionPct}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Closed-Loop Rate</span>
                <span>{state.closedLoopCount > 0
                  ? `${Math.round((state.closedLoopSuccess / state.closedLoopCount) * 100)}%`
                  : 'N/A'}
                </span>
              </div>
            </div>

            <h2 className="text-sm font-bold text-gray-300 tracking-wider mt-5 mb-3">COMPLICATIONS ({complications.length})</h2>
            <div className="space-y-1 text-xs max-h-24 overflow-y-auto">
              {complications.map(c => (
                <div key={c.id} className="flex gap-2 text-red-400">
                  <span className="text-gray-600">{formatTime(c.time)}</span>
                  <span>{c.action}</span>
                </div>
              ))}
              {complications.length === 0 && <p className="text-gray-600">No complications occurred</p>}
            </div>
          </motion.div>

          {debriefAnalysis && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-900 rounded-xl border border-gray-700 p-5"
            >
              <h2 className="text-sm font-bold text-gray-300 tracking-wider mb-3">ROOM CONTROL</h2>
              <RoomControlPanel breakdown={debriefAnalysis.roomControlBreakdown} />
            </motion.div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-900 rounded-xl border border-gray-700 p-5 mt-6"
        >
          <h2 className="text-sm font-bold text-gray-300 tracking-wider mb-3">ACTION TIMELINE</h2>
          <div className="max-h-60 overflow-y-auto space-y-0.5 font-mono text-[11px]">
            {commandActions.map(entry => (
              <div key={entry.id} className="flex gap-3 group relative">
                <span className="text-gray-600 shrink-0">{formatTime(entry.time)}</span>
                <span className="text-blue-300">{entry.action}</span>
                {entry.details && (
                  <span className="text-gray-500 hidden group-hover:inline">— {entry.details}</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="text-center mt-8">
          <button
            onClick={onNewGame}
            className="px-8 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors text-sm"
          >
            Run Another Code
          </button>
        </div>
      </div>
    </div>
  );
}
