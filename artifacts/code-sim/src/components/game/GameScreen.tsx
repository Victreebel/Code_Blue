import { useState } from 'react';
import { type GameState, type TeamRole, type MedicationType, type ReversibleCause,
  REVERSIBLE_CAUSE_LABELS, H_CAUSES, T_CAUSES, SHOCKABLE_RHYTHMS
} from '../../engine/types';
import { formatTime } from '../../engine/gameReducer';
import VitalsMonitor from './VitalsMonitor';
import EventLog from './EventLog';
import StopwatchWidget from './StopwatchWidget';
import PendingOrdersPanel from './PendingOrdersPanel';
import IsometricRoom from './IsometricRoom';
import { motion, AnimatePresence } from 'framer-motion';

interface GameScreenProps {
  state: GameState;
  actions: {
    assignRole: (id: string, role: TeamRole) => void;
    confirmRole: (id: string) => void;
    kickMember: (id: string) => void;
    orderCPR: () => void;
    orderStopCPR: () => void;
    orderRhythmCheck: () => void;
    orderPulseCheck: () => void;
    orderShock: () => void;
    chargeDefib: () => void;
    requestCompressorSwitch: () => void;
    announceCycle: () => void;
    clearRoom: () => void;
    orderMedication: (med: MedicationType, dose: string) => void;
    orderAirway: (advanced: boolean) => void;
    orderIVAccess: (io: boolean) => void;
    identifyCause: (cause: ReversibleCause) => void;
    treatCause: () => void;
    callTimeOfDeath: () => void;
    toggleStopwatch: () => void;
    resetStopwatch: () => void;
    pauseGame: () => void;
    resumeGame: () => void;
  };
}

function CriticalAlertBanner({ state }: { state: GameState }) {
  const { patient, clock } = state;
  const alerts: { text: string; priority: number }[] = [];

  if (!patient.cprInProgress && clock > 5 && !['sinus', 'sinus_brady', 'sinus_tachy'].includes(patient.rhythm)) {
    alerts.push({ text: 'NO CPR IN PROGRESS', priority: 100 });
  }
  if (['sinus', 'sinus_brady', 'sinus_tachy'].includes(patient.rhythm) && clock > 10) {
    const t = patient.lastPulseCheck > 0 ? clock - patient.lastPulseCheck : clock;
    if (t > 10) alerts.push({ text: 'ORGANIZED RHYTHM — CHECK PULSE', priority: 95 });
  }
  if (clock - patient.lastRhythmCheck >= 130) {
    alerts.push({ text: 'RHYTHM CHECK OVERDUE', priority: 80 });
  }
  if ((patient.hasIV || patient.hasIO) && (patient.lastEpinephrine > 0 ? clock - patient.lastEpinephrine : clock) >= 300) {
    alerts.push({ text: 'EPINEPHRINE OVERDUE', priority: 70 });
  }
  if (!patient.hasIV && !patient.hasIO && clock > 30) {
    alerts.push({ text: 'NO IV/IO ACCESS', priority: 60 });
  }
  if (SHOCKABLE_RHYTHMS.includes(patient.rhythm) && !state.defibCharged) {
    alerts.push({ text: 'SHOCKABLE RHYTHM — CHARGE DEFIB', priority: 85 });
  }
  const medRole = state.team.find(m => m.assignedRole === 'medication' && m.inRoom);
  if (!medRole && (patient.hasIV || patient.hasIO) && clock > 30) {
    alerts.push({ text: 'NO ONE ASSIGNED TO MEDS', priority: 55 });
  }

  if (alerts.length === 0) return null;
  alerts.sort((a, b) => b.priority - a.priority);
  const top = alerts[0];

  return (
    <motion.div
      className="bg-red-900/80 backdrop-blur-sm border border-red-700/50 px-4 py-1.5 rounded-lg text-center"
      animate={{ opacity: [1, 0.6, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <span className="text-red-200 text-xs font-bold tracking-wider">{top.text}</span>
    </motion.div>
  );
}

function ProtocolReminders({ state }: { state: GameState }) {
  const { patient, clock, cprCycleStart } = state;
  const timeSinceRhythmCheck = clock - patient.lastRhythmCheck;
  const timeSinceEpi = patient.lastEpinephrine > 0 ? clock - patient.lastEpinephrine : clock;
  const timeSinceCPRStart = patient.cprInProgress ? clock - cprCycleStart : 0;

  const reminders: { text: string; color: string; urgent: boolean }[] = [];

  if (timeSinceRhythmCheck >= 110 && timeSinceRhythmCheck < 130) {
    reminders.push({ text: 'Rhythm check due soon', color: 'text-yellow-400', urgent: false });
  }
  if ((patient.hasIV || patient.hasIO) && timeSinceEpi >= 170 && timeSinceEpi < 300) {
    reminders.push({ text: 'Consider next epinephrine', color: 'text-yellow-400', urgent: false });
  }
  if (timeSinceCPRStart >= 100 && patient.cprInProgress) {
    reminders.push({ text: 'Consider compressor switch', color: 'text-yellow-400', urgent: false });
  }

  if (reminders.length === 0) return null;

  return (
    <div className="space-y-0.5 mt-1">
      {reminders.map((r, i) => (
        <div key={i} className={`text-[9px] px-2 py-0.5 rounded ${r.color} bg-gray-900/60`}>
          {r.text}
        </div>
      ))}
    </div>
  );
}

function CompressionFractionHUD({ fraction, cprQuality }: { fraction: number; cprQuality: number }) {
  const pct = Math.round(fraction * 100);
  const qualPct = Math.round(cprQuality * 100);
  const fractionColor = pct >= 60 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400';
  const qualColor = qualPct >= 80 ? 'text-green-400' : qualPct >= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex gap-3 text-[10px]">
      <div className="flex items-center gap-1">
        <span className="text-gray-500">CPR%</span>
        <span className={`font-mono font-bold ${fractionColor}`}>{pct}%</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500">Quality</span>
        <span className={`font-mono font-bold ${qualColor}`}>{qualPct}%</span>
      </div>
    </div>
  );
}

function HsCausesPanel({ patient, actions }: {
  patient: GameState['patient'];
  actions: { identifyCause: (c: ReversibleCause) => void; treatCause: () => void };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-purple-400 hover:bg-gray-800/50"
      >
        <span>H's & T's</span>
        <span className="text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-0.5">
              <div className="text-[9px] text-gray-500 font-bold px-1">H's:</div>
              {H_CAUSES.map(c => (
                <button
                  key={c}
                  onClick={() => actions.identifyCause(c)}
                  className={`w-full text-left text-[10px] px-2 py-1 rounded ${patient.reversibleCauseIdentified && patient.reversibleCause === c ? 'bg-purple-800/60 text-purple-200 font-bold' : 'bg-purple-900/30 text-purple-300 hover:bg-purple-800/40'}`}
                >
                  {patient.reversibleCauseIdentified && patient.reversibleCause === c ? '✓ ' : ''}{REVERSIBLE_CAUSE_LABELS[c]}
                </button>
              ))}
              <div className="text-[9px] text-gray-500 font-bold px-1 mt-1">T's:</div>
              {T_CAUSES.map(c => (
                <button
                  key={c}
                  onClick={() => actions.identifyCause(c)}
                  className={`w-full text-left text-[10px] px-2 py-1 rounded ${patient.reversibleCauseIdentified && patient.reversibleCause === c ? 'bg-purple-800/60 text-purple-200 font-bold' : 'bg-purple-900/30 text-purple-300 hover:bg-purple-800/40'}`}
                >
                  {patient.reversibleCauseIdentified && patient.reversibleCause === c ? '✓ ' : ''}{REVERSIBLE_CAUSE_LABELS[c]}
                </button>
              ))}
              {patient.reversibleCauseIdentified && !patient.reversibleCauseTreated && (
                <button
                  onClick={actions.treatCause}
                  className="w-full text-left text-[10px] px-2 py-1.5 rounded bg-green-900/50 text-green-300 hover:bg-green-800/60 font-bold mt-1"
                >
                  Treat Identified Cause
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TeamQuickActions({ actions, state }: {
  actions: GameScreenProps['actions'];
  state: GameState;
}) {
  const [confirmTOD, setConfirmTOD] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-gray-300 hover:bg-gray-800/50"
      >
        <span>Team / Other</span>
        <span className="text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-1">
              <button onClick={actions.announceCycle} className="w-full text-left text-[10px] px-2 py-1 rounded bg-indigo-900/40 text-indigo-300 hover:bg-indigo-800/50">
                Announce Cycle Status
              </button>
              {!confirmTOD ? (
                <button
                  onClick={() => setConfirmTOD(true)}
                  className="w-full text-left text-[10px] px-2 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50"
                >
                  Call Time of Death
                </button>
              ) : (
                <div className="bg-red-900/30 border border-red-800 rounded p-2">
                  <p className="text-[9px] text-red-300 mb-1.5">End the code?</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { actions.callTimeOfDeath(); setConfirmTOD(false); }}
                      className="text-[10px] px-2.5 py-0.5 rounded bg-red-800 text-red-200 hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmTOD(false)}
                      className="text-[10px] px-2.5 py-0.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GameScreen({ state, actions }: GameScreenProps) {
  const [showLog, setShowLog] = useState(true);

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/50 px-4 py-1.5 flex items-center justify-between shrink-0" style={{ zIndex: 600 }}>
        <div className="flex items-center gap-3">
          <motion.div
            className="flex items-center gap-1.5"
            animate={state.running ? { opacity: [1, 0.6, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className={`w-2 h-2 rounded-full ${state.running ? 'bg-red-500' : 'bg-gray-600'}`} />
            <span className="text-red-400 text-[10px] font-bold tracking-widest">CODE BLUE</span>
          </motion.div>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400 text-xs">{state.scenario?.patientName}</span>
          <span className="text-gray-600 text-[10px]">{state.scenario?.patientAge}yo {state.scenario?.patientSex}</span>
        </div>

        <CriticalAlertBanner state={state} />

        <div className="flex items-center gap-3">
          <div className="font-mono text-lg text-gray-200">{formatTime(state.clock)}</div>
          {state.phase === 'active' && (
            <button onClick={actions.pauseGame} className="text-[10px] px-2.5 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors">
              PAUSE
            </button>
          )}
          {state.phase === 'paused' && (
            <button onClick={actions.resumeGame} className="text-[10px] px-2.5 py-1 rounded bg-green-900/60 text-green-300 hover:bg-green-800/70 transition-colors">
              RESUME
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <IsometricRoom
          team={state.team}
          patient={state.patient}
          clock={state.clock}
          roomCapacity={state.roomCapacity}
          chaosLevel={state.chaosLevel}
          defibCharged={state.defibCharged}
          pendingOrders={state.pendingOrders}
          actions={actions}
        />

        <div className="absolute top-3 left-3 w-64 flex flex-col gap-2" style={{ zIndex: 500 }}>
          <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700/50 overflow-hidden">
            <VitalsMonitor patient={state.patient} clock={state.clock} />
          </div>
          <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700/50 p-2">
            <CompressionFractionHUD fraction={state.compressionFraction} cprQuality={state.patient.cprQuality} />
          </div>
          <ProtocolReminders state={state} />
        </div>

        <div className="absolute top-3 right-3 w-72 flex flex-col gap-2" style={{ zIndex: 500, maxHeight: 'calc(100% - 24px)' }}>
          <PendingOrdersPanel orders={state.pendingOrders} clock={state.clock} team={state.team} />
          <HsCausesPanel patient={state.patient} actions={actions} />
          <TeamQuickActions actions={actions} state={state} />
          <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700/50 overflow-hidden">
            <StopwatchWidget
              stopwatch={state.stopwatch}
              onToggle={actions.toggleStopwatch}
              onReset={actions.resetStopwatch}
            />
          </div>
        </div>

        <div className="absolute bottom-3 right-3" style={{ zIndex: 500, width: showLog ? 360 : 'auto' }}>
          <button
            onClick={() => setShowLog(!showLog)}
            className="text-[9px] px-2 py-0.5 rounded-t bg-gray-800/90 text-gray-400 hover:text-gray-200 border border-b-0 border-gray-700/50"
          >
            {showLog ? 'HIDE LOG' : 'SHOW LOG'}
          </button>
          <AnimatePresence>
            {showLog && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 200, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-gray-900/90 backdrop-blur-sm rounded-b-lg rounded-tr-lg border border-gray-700/50"
              >
                <EventLog entries={state.actionLog} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
