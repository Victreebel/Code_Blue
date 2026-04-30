import { motion } from 'framer-motion';
import type { UIState } from '../../engine/ui/uiStateEngine';
import type { ScenarioInput } from '../../engine/types/scenario';
import type { EngineActions } from '../../engine/useGameEngine';
import { formatTime, RHYTHM_LABELS } from '../../engine/types/core';
import VitalsMonitor from './VitalsMonitor';
import TeamPanel from './TeamPanel';
import CommandPanel from './CommandPanel';
import EventLog from './EventLog';
import StopwatchWidget from './StopwatchWidget';
import PendingOrdersPanel from './PendingOrdersPanel';
import LiveRoomCanvas from './LiveRoomCanvas';

interface GameScreenProps {
  ui: UIState;
  scenarioInput: ScenarioInput;
  actions: EngineActions;
}

function ProtocolReminders({ ui }: { ui: UIState }) {
  const reminders: { text: string; color: string; priority: number; urgent: boolean }[] = [];

  const isShockable = ui.rhythm === 'vfib' || ui.rhythm === 'vtach';
  const isArrest = isShockable || ui.rhythm === 'pea' || ui.rhythm === 'asystole';
  const isPerfusing = !isArrest;

  if (!ui.cprActive && ui.clock > 5 && isArrest) {
    reminders.push({ text: 'CPR NOT IN PROGRESS', color: 'text-red-400', priority: 100, urgent: true });
  }

  if (isPerfusing && ui.clock > 10) {
    reminders.push({ text: 'ORGANIZED RHYTHM — CHECK PULSE; ROSC DETECTS AUTOMATICALLY', color: 'text-pink-400', priority: 95, urgent: true });
  }

  const lastRhythm = ui.lastRhythmCheckAt ?? 0;
  const timeSinceRhythmCheck = ui.clock - lastRhythm;
  if (timeSinceRhythmCheck >= 130) {
    reminders.push({ text: 'RHYTHM CHECK OVERDUE', color: 'text-red-400', priority: 80, urgent: true });
  } else if (timeSinceRhythmCheck >= 110) {
    reminders.push({ text: 'Rhythm check due soon', color: 'text-yellow-400', priority: 30, urgent: false });
  }

  if ((ui.hasIVAccess || ui.hasIOAccess) && ui.lastEpiAt !== null) {
    const t = ui.clock - ui.lastEpiAt;
    if (t >= 300) reminders.push({ text: 'EPINEPHRINE OVERDUE', color: 'text-red-400', priority: 70, urgent: true });
    else if (t >= 170) reminders.push({ text: 'Consider next epinephrine dose', color: 'text-yellow-400', priority: 25, urgent: false });
  }

  if (!ui.hasIVAccess && !ui.hasIOAccess && ui.clock > 30) {
    reminders.push({ text: 'No vascular access', color: 'text-orange-400', priority: 15, urgent: false });
  }

  if (reminders.length === 0) return null;
  reminders.sort((a, b) => b.priority - a.priority);
  const top = reminders[0];
  const rest = reminders.slice(1);
  return (
    <div className="space-y-1">
      <motion.div
        className={`text-[11px] px-2 py-1.5 rounded font-bold ${top.color} ${top.urgent ? 'bg-red-900/40 border border-red-800/50' : 'bg-gray-800/70'}`}
        animate={top.urgent ? { opacity: [1, 0.6, 1] } : {}}
        transition={{ duration: 1, repeat: Infinity }}
      >
        {top.text}
      </motion.div>
      {rest.map((r, i) => (
        <div key={i} className={`text-[9px] px-2 py-0.5 rounded ${r.urgent ? r.color : 'text-gray-500'} bg-gray-800/30`}>
          {r.text}
        </div>
      ))}
    </div>
  );
}

export default function GameScreen({ ui, scenarioInput, actions }: GameScreenProps) {
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <motion.div
            className="flex items-center gap-2"
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-400 text-xs font-bold tracking-wider">CODE BLUE</span>
          </motion.div>
          <span className="text-gray-500 text-xs">|</span>
          <span className="text-gray-400 text-xs">{scenarioInput.patientName}</span>
          <span className="text-gray-600 text-xs">{scenarioInput.patientAge}yo {scenarioInput.patientSex}</span>
          <span className="text-gray-600 text-xs">|</span>
          <span className="text-amber-300 text-xs">{RHYTHM_LABELS[ui.rhythm]}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="font-mono text-lg text-gray-200">{formatTime(ui.clock)}</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-2 p-2 min-h-0 overflow-hidden">
        <div className="col-span-2 flex flex-col gap-2 overflow-y-auto">
          <VitalsMonitor ui={ui} />
          <StopwatchWidget clock={ui.clock} lastEpiAt={ui.lastEpiAt} lastRhythmCheckAt={ui.lastRhythmCheckAt} />
          <ProtocolReminders ui={ui} />
        </div>

        <div className="col-span-3 flex flex-col gap-2 overflow-y-auto">
          <LiveRoomCanvas team={ui.team} cprActive={ui.cprActive} />
          <TeamPanel team={ui.team} onAssignRole={actions.assignRole} onConfirmRole={actions.confirmRole} />
        </div>

        <div className="col-span-3 flex flex-col gap-2 overflow-y-auto">
          <CommandPanel ui={ui} actions={actions} pendingOrders={ui.pendingOrders} />
          <PendingOrdersPanel orders={ui.pendingOrders} clock={ui.clock} />
        </div>

        <div className="col-span-4 min-h-0">
          <EventLog events={ui.recentLog} team={ui.team} />
        </div>
      </div>
    </div>
  );
}
