import { type GameState, type TeamRole, type MedicationType, type ReversibleCause } from '../../engine/types';
import { formatTime } from '../../engine/gameReducer';
import VitalsMonitor from './VitalsMonitor';
import TeamPanel from './TeamPanel';
import CommandPanel from './CommandPanel';
import EventLog from './EventLog';
import StopwatchWidget from './StopwatchWidget';
import PendingOrdersPanel from './PendingOrdersPanel';
import LiveRoomCanvas from './LiveRoomCanvas';
import { motion } from 'framer-motion';

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

function ProtocolReminders({ state }: { state: GameState }) {
  const { patient, clock, cprCycleStart } = state;
  const timeSinceRhythmCheck = clock - patient.lastRhythmCheck;
  const timeSinceEpi = patient.lastEpinephrine > 0 ? clock - patient.lastEpinephrine : clock;
  const timeSinceCPRStart = patient.cprInProgress ? clock - cprCycleStart : 0;

  const reminders: { text: string; color: string; urgent: boolean }[] = [];

  if (timeSinceRhythmCheck >= 110 && timeSinceRhythmCheck < 130) {
    reminders.push({ text: 'Rhythm check due soon', color: 'text-yellow-400', urgent: false });
  } else if (timeSinceRhythmCheck >= 130) {
    reminders.push({ text: 'RHYTHM CHECK OVERDUE', color: 'text-red-400', urgent: true });
  }

  if ((patient.hasIV || patient.hasIO) && timeSinceEpi >= 170 && timeSinceEpi < 300) {
    reminders.push({ text: 'Consider next epinephrine dose', color: 'text-yellow-400', urgent: false });
  } else if ((patient.hasIV || patient.hasIO) && timeSinceEpi >= 300) {
    reminders.push({ text: 'EPINEPHRINE OVERDUE', color: 'text-red-400', urgent: true });
  }

  if (timeSinceCPRStart >= 100 && patient.cprInProgress) {
    reminders.push({ text: 'Consider compressor switch', color: 'text-yellow-400', urgent: false });
  }

  if (!patient.cprInProgress && clock > 5 && !['sinus', 'sinus_brady', 'sinus_tachy'].includes(patient.rhythm)) {
    reminders.push({ text: 'CPR NOT IN PROGRESS', color: 'text-red-400', urgent: true });
  }

  if (['sinus', 'sinus_brady', 'sinus_tachy'].includes(patient.rhythm) && clock > 10) {
    const timeSincePulseCheck = patient.lastPulseCheck > 0 ? clock - patient.lastPulseCheck : clock;
    if (timeSincePulseCheck > 10) {
      reminders.push({ text: 'ORGANIZED RHYTHM — CHECK PULSE', color: 'text-pink-400', urgent: true });
    }
  }

  if (!patient.hasIV && !patient.hasIO && clock > 30) {
    reminders.push({ text: 'No vascular access', color: 'text-orange-400', urgent: false });
  }

  if (reminders.length === 0) return null;

  return (
    <div className="space-y-1">
      {reminders.map((r, i) => (
        <motion.div
          key={i}
          className={`text-[10px] px-2 py-1 rounded ${r.color} ${r.urgent ? 'bg-red-900/30 font-bold' : 'bg-gray-800/50'}`}
          animate={r.urgent ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          {r.text}
        </motion.div>
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
    <div className="bg-gray-900/90 rounded-lg border border-gray-700 p-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-gray-500">CPR Fraction</span>
        <span className={`font-mono font-bold ${fractionColor}`}>{pct}%</span>
      </div>
      <div className="flex items-center justify-between text-[10px] mt-0.5">
        <span className="text-gray-500">Quality</span>
        <span className={`font-mono font-bold ${qualColor}`}>{qualPct}%</span>
      </div>
    </div>
  );
}

export default function GameScreen({ state, actions }: GameScreenProps) {
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <motion.div
            className="flex items-center gap-2"
            animate={state.running ? { opacity: [1, 0.6, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className={`w-2 h-2 rounded-full ${state.running ? 'bg-red-500' : 'bg-gray-600'}`} />
            <span className="text-red-400 text-xs font-bold tracking-wider">CODE BLUE</span>
          </motion.div>
          <span className="text-gray-500 text-xs">|</span>
          <span className="text-gray-400 text-xs">{state.scenario?.patientName}</span>
          <span className="text-gray-600 text-xs">
            {state.scenario?.patientAge}yo {state.scenario?.patientSex}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="font-mono text-lg text-gray-200">{formatTime(state.clock)}</div>
          {state.phase === 'active' && (
            <button
              onClick={actions.pauseGame}
              className="text-[10px] px-2 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700"
            >
              PAUSE
            </button>
          )}
          {state.phase === 'paused' && (
            <button
              onClick={actions.resumeGame}
              className="text-[10px] px-2 py-1 rounded bg-green-900/60 text-green-300 hover:bg-green-800/70"
            >
              RESUME
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-2 p-2 min-h-0 overflow-hidden">
        <div className="col-span-2 flex flex-col gap-2 overflow-y-auto">
          <VitalsMonitor patient={state.patient} clock={state.clock} />
          <CompressionFractionHUD fraction={state.compressionFraction} cprQuality={state.patient.cprQuality} />
          <StopwatchWidget
            stopwatch={state.stopwatch}
            onToggle={actions.toggleStopwatch}
            onReset={actions.resetStopwatch}
          />
          <ProtocolReminders state={state} />
        </div>

        <div className="col-span-3 flex flex-col gap-2 overflow-y-auto">
          <LiveRoomCanvas
            team={state.team}
            patient={state.patient}
            clock={state.clock}
            roomCapacity={state.roomCapacity}
            chaosLevel={state.chaosLevel}
          />
          <TeamPanel
            team={state.team}
            onAssignRole={actions.assignRole}
            onConfirmRole={actions.confirmRole}
            onKickMember={actions.kickMember}
            roomCapacity={state.roomCapacity}
          />
        </div>

        <div className="col-span-3 flex flex-col gap-2 overflow-y-auto">
          <CommandPanel
            patient={state.patient}
            defibCharged={state.defibCharged}
            onOrderCPR={actions.orderCPR}
            onOrderStopCPR={actions.orderStopCPR}
            onOrderRhythmCheck={actions.orderRhythmCheck}
            onOrderPulseCheck={actions.orderPulseCheck}
            onOrderShock={actions.orderShock}
            onChargeDefib={actions.chargeDefib}
            onRequestCompressorSwitch={actions.requestCompressorSwitch}
            onAnnounceCycle={actions.announceCycle}
            onClearRoom={actions.clearRoom}
            onOrderMedication={actions.orderMedication}
            onOrderAirway={actions.orderAirway}
            onOrderIVAccess={actions.orderIVAccess}
            onIdentifyCause={actions.identifyCause}
            onTreatCause={actions.treatCause}
            onCallTimeOfDeath={actions.callTimeOfDeath}
          />
          <PendingOrdersPanel orders={state.pendingOrders} clock={state.clock} />
        </div>

        <div className="col-span-4 min-h-0">
          <EventLog entries={state.actionLog} />
        </div>
      </div>
    </div>
  );
}
