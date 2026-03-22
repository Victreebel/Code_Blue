import { type GameState, type ActionLogEntry, RHYTHM_LABELS, REVERSIBLE_CAUSE_LABELS } from '../../engine/types';
import { formatTime } from '../../engine/gameReducer';
import { getGrade } from '../../engine/scoringEngine';
import { motion } from 'framer-motion';

interface DebriefScreenProps {
  state: GameState;
  onNewGame: () => void;
}

function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className="mb-2">
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

export default function DebriefScreen({ state, onNewGame }: DebriefScreenProps) {
  const { score, actionLog, scenario, patient, clock } = state;
  const grade = getGrade(score.total);

  const commandActions = actionLog.filter(l => l.category === 'command');
  const complications = actionLog.filter(l => l.category === 'complication');
  const roscAchieved = actionLog.some(l => l.action.includes('ROSC'));
  const todCalled = actionLog.some(l => l.action.includes('Time of death'));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <ScoreBar label="Rhythm Check Timing" score={score.rhythmCheckTiming} max={15} color="bg-green-500" />
              <ScoreBar label="Epinephrine Timing" score={score.epinephrineTiming} max={15} color="bg-blue-500" />
              <ScoreBar label="Defibrillation" score={score.defibrillationTiming} max={15} color="bg-orange-500" />
              <ScoreBar label="Medication Choices" score={score.medicationChoices} max={10} color="bg-purple-500" />
              <ScoreBar label="Closed-Loop Communication" score={score.closedLoopComm} max={15} color="bg-cyan-500" />
              <ScoreBar label="Team Management" score={score.teamManagement} max={15} color="bg-yellow-500" />
              <ScoreBar label="Reversible Causes" score={score.reversibleCauses} max={10} color="bg-pink-500" />
              <ScoreBar label="Overall Leadership" score={score.overallLeadership} max={10} color="bg-indigo-500" />
              {score.penalties < 0 && (
                <div className="text-xs text-red-400 mt-2">Penalties: {score.penalties} pts</div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
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
                <span className="text-gray-500">ROSC Achievable</span>
                <span className={scenario?.roscAchievable ? 'text-green-400' : 'text-gray-500'}>
                  {scenario?.roscAchievable ? 'Yes' : 'No'}
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
              <div key={entry.id} className="flex gap-3">
                <span className="text-gray-600 shrink-0">{formatTime(entry.time)}</span>
                <span className="text-blue-300">{entry.action}</span>
                {entry.details && <span className="text-gray-500">— {entry.details}</span>}
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
