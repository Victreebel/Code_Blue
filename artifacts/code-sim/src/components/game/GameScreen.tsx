import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UIState } from '../../engine/ui/uiStateEngine';
import type { ScenarioInput } from '../../engine/types/scenario';
import type { EngineActions } from '../../engine/useGameEngine';
import { formatTime, RHYTHM_LABELS } from '../../engine/types/core';
import { CAUSE_MAPPINGS, INVESTIGATION_LABELS } from '../../engine/clinical/reversiblesEngine';
import type { ReversibleCauseState } from '../../engine/types/clinical';
import {
  RHYTHM_CHECK_INTERVAL_SECONDS,
  RHYTHM_CHECK_GRACE_SECONDS,
  EPI_MAX_INTERVAL_SECONDS,
  EPI_MIN_INTERVAL_SECONDS,
  EPI_WARNING_LEAD_SECONDS,
} from '../../engine/clinical/aclsConstants';
import VitalsMonitor from './VitalsMonitor';
import StopwatchWidget from './StopwatchWidget';
import PendingOrdersPanel from './PendingOrdersPanel';
import EventLog from './EventLog';
import FirstPersonRoom from './FirstPersonRoom';

interface GameScreenProps {
  ui: UIState;
  scenarioInput: ScenarioInput;
  actions: EngineActions;
}

/* ── Protocol Reminders ───────────────────────────────────────────── */

function ProtocolReminders({ ui }: { ui: UIState }) {
  const reminders: { text: string; color: string; priority: number; urgent: boolean }[] = [];

  const isShockable = ui.rhythm === 'vfib' || ui.rhythm === 'vtach';
  const isArrest = isShockable || ui.rhythm === 'pea' || ui.rhythm === 'asystole';
  const isPerfusing = !isArrest;

  if (!ui.cprActive && ui.clock > 5 && isArrest) {
    reminders.push({ text: 'CPR NOT IN PROGRESS', color: 'text-red-400', priority: 100, urgent: true });
  }
  if (isPerfusing && ui.clock > 10) {
    reminders.push({ text: 'ORGANIZED RHYTHM — CHECK PULSE', color: 'text-pink-400', priority: 95, urgent: true });
  }
  const lastRhythm = ui.lastRhythmCheckAt ?? 0;
  const timeSinceRhythmCheck = ui.clock - lastRhythm;
  if (timeSinceRhythmCheck >= RHYTHM_CHECK_INTERVAL_SECONDS + RHYTHM_CHECK_GRACE_SECONDS) {
    reminders.push({ text: 'RHYTHM CHECK OVERDUE', color: 'text-red-400', priority: 80, urgent: true });
  } else if (timeSinceRhythmCheck >= RHYTHM_CHECK_INTERVAL_SECONDS - RHYTHM_CHECK_GRACE_SECONDS) {
    reminders.push({ text: 'Rhythm check due soon', color: 'text-yellow-400', priority: 30, urgent: false });
  }
  if ((ui.hasIVAccess || ui.hasIOAccess) && ui.lastEpiAt !== null) {
    const t = ui.clock - ui.lastEpiAt;
    if (t >= EPI_MAX_INTERVAL_SECONDS) reminders.push({ text: 'EPINEPHRINE OVERDUE', color: 'text-red-400', priority: 70, urgent: true });
    else if (t >= EPI_MIN_INTERVAL_SECONDS - EPI_WARNING_LEAD_SECONDS) reminders.push({ text: 'Consider next epinephrine', color: 'text-yellow-400', priority: 25, urgent: false });
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

/* ── H's & T's Dashboard (read-only) ────────────────────────────────── */

const STATUS_COLORS: Record<ReversibleCauseState['status'], { bar: string; text: string; bg: string }> = {
  red:    { bar: 'bg-red-500',    text: 'text-red-400',    bg: 'bg-red-950/30' },
  yellow: { bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-950/30' },
  green:  { bar: 'bg-green-500',  text: 'text-green-400',  bg: 'bg-green-950/30' },
};

function HsCausesPanel({ ui }: { ui: UIState }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-gray-900/85 border border-gray-700 rounded-lg overflow-hidden backdrop-blur-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-[10px] text-purple-400 tracking-wider font-semibold">H's &amp; T's</span>
        <span className="text-[10px] text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-1">
              {CAUSE_MAPPINGS.map(cause => {
                const state = ui.reversibles[cause.causeId];
                const colors = STATUS_COLORS[state?.status ?? 'red'];
                const doneInvs = state?.investigationsDone ?? [];
                return (
                  <div key={cause.causeId} className={`rounded px-2 py-1 ${colors.bg}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${colors.bar}`} />
                      <span className={`text-[10px] font-semibold ${colors.text}`}>{cause.label}</span>
                    </div>
                    <div className="text-[8px] text-gray-500 mt-0.5 leading-tight">
                      {doneInvs.length > 0
                        ? `Done: ${doneInvs.map(i => INVESTIGATION_LABELS[i] ?? i).join(', ')}`
                        : 'No investigations yet'}
                    </div>
                    <div className="text-[8px] text-gray-600 leading-tight">
                      {ui.hasUltrasound ? (cause.withUSClue ?? '') : (cause.withoutUSClue ?? '')}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Investigations Panel ─────────────────────────────────────────── */

interface InvGroup {
  label: string;
  color: string;
  items: { key: string; label: string; action: () => void; disabled?: boolean }[];
}

function InvestigationsPanel({ ui, actions }: { ui: UIState; actions: EngineActions }) {
  const [open, setOpen] = useState(false);

  const groups: InvGroup[] = [
    {
      label: 'Vascular / Labs',
      color: 'text-blue-400',
      items: [
        { key: 'iv_access', label: 'IV Access', action: actions.ivAccess, disabled: ui.hasIVAccess },
        { key: 'io_access', label: 'IO Access', action: actions.ioAccess, disabled: ui.hasIOAccess },
        { key: 'blood_draw', label: 'Blood draw', action: actions.orderBloodDraw },
        { key: 'poc_glucose', label: 'Glucose', action: actions.orderPocGlucose },
        { key: 'vbg_istat', label: 'VBG / iStat', action: actions.orderVbgIstat },
        { key: 'bmp', label: 'BMP (slow)', action: actions.orderBmp },
      ],
    },
    {
      label: 'Cardiac / Imaging',
      color: 'text-red-400',
      items: [
        { key: 'rhythm_check', label: 'Rhythm check', action: actions.rhythmCheck },
        { key: 'ecg_12lead', label: '12-lead ECG', action: actions.orderEcg12lead },
        { key: 'pocus', label: 'POCUS', action: actions.orderPocus },
        { key: 'chest_xray', label: 'Chest X-ray (slow)', action: actions.orderChestXray },
      ],
    },
    {
      label: 'Other',
      color: 'text-teal-400',
      items: [
        { key: 'capnography', label: 'Capnography / ETCO2', action: actions.orderCapnography },
        { key: 'core_temp', label: 'Core temperature', action: actions.orderCoreTemp },
        { key: 'medication_review', label: 'Med / History review', action: actions.orderMedicationReview },
        { key: 'tox_screen', label: 'Tox screen', action: actions.orderToxScreen },
      ],
    },
  ];

  return (
    <div className="bg-gray-900/85 border border-gray-700 rounded-lg overflow-hidden backdrop-blur-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-[10px] text-cyan-400 tracking-wider font-semibold">INVESTIGATIONS</span>
        <span className="text-[10px] text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-2">
              {groups.map(g => (
                <div key={g.label}>
                  <div className={`text-[9px] font-semibold ${g.color} mb-0.5`}>{g.label}</div>
                  <div className="space-y-0.5">
                    {g.items.map(item => (
                      <button
                        key={item.key}
                        onClick={item.action}
                        disabled={item.disabled}
                        className={`w-full text-left text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                          item.disabled
                            ? 'bg-gray-800/40 text-gray-600 cursor-default'
                            : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/60 hover:text-white'
                        }`}
                      >
                        {item.disabled ? `✓ ${item.label}` : item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Team Quick Actions Panel ─────────────────────────────────────── */

function TeamQuickActions({ ui, actions }: { ui: UIState; actions: EngineActions }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-gray-900/85 border border-gray-700 rounded-lg overflow-hidden backdrop-blur-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-[10px] text-teal-400 tracking-wider font-semibold">TEAM / OTHER</span>
        <span className="text-[10px] text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-1">
              <button
                onClick={actions.announceCycle}
                className="w-full text-left text-[10px] px-2 py-1 rounded bg-teal-900/40 text-teal-200 hover:bg-teal-800/50 font-semibold transition-colors"
              >
                Announce CPR Cycle
              </button>
              <button
                onClick={actions.callTimeOfDeath}
                className="w-full text-left text-[10px] px-2 py-1 rounded bg-red-900/40 text-red-300 hover:bg-red-800/50 font-semibold transition-colors"
              >
                Call Time of Death
              </button>
              <button
                onClick={actions.declareRosc}
                className="w-full text-left text-[10px] px-2 py-1 rounded bg-green-900/40 text-green-300 hover:bg-green-800/50 font-semibold transition-colors"
              >
                Declare ROSC
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Protocol Reminders collapsible ──────────────────────────────── */

function CollapsibleReminders({ ui }: { ui: UIState }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-gray-900/85 border border-gray-800 rounded-lg overflow-hidden backdrop-blur-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-[10px] text-gray-500 tracking-wider">REMINDERS</span>
        <span className="text-[10px] text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2">
              <ProtocolReminders ui={ui} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Event Log collapsible ────────────────────────────────────────── */

function CollapsibleEventLog({ ui }: { ui: UIState }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-gray-900/85 border border-gray-700 rounded-lg overflow-hidden backdrop-blur-sm flex flex-col">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-800/50 transition-colors shrink-0"
      >
        <span className="text-[10px] text-gray-400 tracking-wider">EVENT LOG</span>
        <span className="text-[10px] text-gray-600">{open ? '▲' : '▼'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 200, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
            style={{ minHeight: 0 }}
          >
            <div className="h-[200px]">
              <EventLog events={ui.recentLog} team={ui.team} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Critical Alert Banner ────────────────────────────────────────── */

function CriticalAlertBanner({ ui }: { ui: UIState }) {
  const isShockable = ui.rhythm === 'vfib' || ui.rhythm === 'vtach';
  const isArrest = isShockable || ui.rhythm === 'pea' || ui.rhythm === 'asystole';

  if (!isArrest && ui.clock > 10) {
    return (
      <motion.div
        className="text-green-300 text-xs font-bold tracking-wider"
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        ROSC — ORGANIZED RHYTHM
      </motion.div>
    );
  }
  if (!ui.cprActive && isArrest && ui.clock > 5) {
    return (
      <motion.div
        className="text-red-400 text-xs font-bold tracking-wider bg-red-950/60 px-3 py-0.5 rounded border border-red-800/60"
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      >
        ⚠ NO CPR IN PROGRESS
      </motion.div>
    );
  }
  if (ui.defibCharged) {
    return (
      <motion.div
        className="text-amber-300 text-xs font-bold tracking-wider"
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 0.6, repeat: Infinity }}
      >
        ⚡ DEFIB CHARGED — STAND CLEAR
      </motion.div>
    );
  }
  return null;
}

/* ── Game Screen ──────────────────────────────────────────────────── */

export default function GameScreen({ ui, scenarioInput, actions }: GameScreenProps) {
  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">

      {/* ── Header bar ── */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <motion.div
            className="flex items-center gap-2"
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-400 text-xs font-bold tracking-wider">CODE BLUE</span>
          </motion.div>
          <span className="text-gray-500 text-xs">|</span>
          <span className="text-gray-300 text-xs font-semibold">{scenarioInput.patientName}</span>
          <span className="text-gray-500 text-xs">{scenarioInput.patientAge}yo {scenarioInput.patientSex}</span>
          <span className="text-gray-600 text-xs">|</span>
          <span className="text-amber-300 text-xs">{RHYTHM_LABELS[ui.rhythm]}</span>
        </div>

        <div className="flex-1 flex justify-center px-4">
          <CriticalAlertBanner ui={ui} />
        </div>

        <div className="flex items-center gap-4">
          <div className="font-mono text-lg text-gray-200">{formatTime(ui.clock)}</div>
        </div>
      </div>

      {/* ── Body: IsometricRoom fills flex-1, overlays float on top ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Full-screen isometric room */}
        <div className="absolute inset-0">
          <FirstPersonRoom ui={ui} actions={actions} />
        </div>

        {/* ── Left overlay column ── */}
        <div className="absolute top-2 left-2 z-20 flex flex-col gap-2" style={{ width: 200 }}>
          <VitalsMonitor ui={ui} />
          <StopwatchWidget
            clock={ui.clock}
            lastEpiAt={ui.lastEpiAt}
            lastRhythmCheckAt={ui.lastRhythmCheckAt}
          />
          <CollapsibleReminders ui={ui} />
        </div>

        {/* ── Right overlay column ── */}
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-2" style={{ width: 200 }}>
          <PendingOrdersPanel orders={ui.pendingOrders} clock={ui.clock} />
          <InvestigationsPanel ui={ui} actions={actions} />
          <HsCausesPanel ui={ui} />
          <TeamQuickActions ui={ui} actions={actions} />
        </div>

        {/* ── Bottom-right: collapsible event log ── */}
        <div className="absolute bottom-2 right-2 z-20" style={{ width: 280 }}>
          <CollapsibleEventLog ui={ui} />
        </div>

      </div>
    </div>
  );
}
