import type { SimulationState } from '../types/state';
import type { PendingOrder } from '../types/orders';
import type { ReplayEvent } from '../types/replay';
import type { TeamMemberRuntime } from '../types/team';
import type { ReversibleCauseState } from '../types/clinical';
import { findEvents } from '../replay/replayEngine';
import { isTerminal as isOrderTerminal } from '../orders/pendingOrdersEngine';

const TERMINAL_DISPLAY_SECONDS = 5;

export interface UIState {
  phase: SimulationState['phase'];
  clock: number;
  scenarioId: string;
  outcome: SimulationState['scenario']['outcome'];
  rhythmLabel: string;
  rhythm: SimulationState['rhythm']['current'];
  pulsePresent: boolean;
  vitals: {
    hr: number;
    sysBP: number;
    diaBP: number;
    spo2: number;
    etco2: number;
    perfusionIndex: number;
    etco2Trend: number[];
  };
  cprActive: boolean;
  defibCharged: boolean;
  shockCount: number;
  hasIVAccess: boolean;
  hasIOAccess: boolean;
  hasAdvancedAirway: boolean;
  amiodaroneDoses: number;
  lastEpiAt: number | null;
  lastRhythmCheckAt: number | null;
  team: TeamMemberRuntime[];
  pendingOrders: PendingOrder[];
  recentLog: ReplayEvent[];
  chaosFiredCount: number;
  scoreReport: SimulationState['score'];
  /* Reversibles */
  reversibles: Record<string, ReversibleCauseState>;
  hasUltrasound: boolean;
  workingDiagnosis: string | null;
  investigationCount: number;
  inappropriateInvestigations: number;
}

export function selectUIState(state: SimulationState): UIState {
  const recent = state.replay.events.slice(-200);
  return {
    phase: state.phase,
    clock: state.clock,
    scenarioId: state.scenario.id,
    outcome: state.scenario.outcome,
    rhythmLabel: state.rhythm.current,
    rhythm: state.rhythm.current,
    pulsePresent: state.rhythm.pulsePresent,
    vitals: {
      hr: state.physiology.hr,
      sysBP: state.physiology.sysBP,
      diaBP: state.physiology.diaBP,
      spo2: state.physiology.spo2,
      etco2: state.physiology.etco2,
      perfusionIndex: state.physiology.perfusionIndex,
      etco2Trend: state.physiology.etco2Trend,
    },
    cprActive: state.clinical.cprActive,
    defibCharged: state.clinical.defibCharged,
    shockCount: state.clinical.shockCount,
    hasIVAccess: state.clinical.hasIVAccess,
    hasIOAccess: state.clinical.hasIOAccess,
    hasAdvancedAirway: state.clinical.hasAdvancedAirway,
    amiodaroneDoses: state.clinical.amiodaroneDoses,
    lastEpiAt: state.clinical.lastEpiAt,
    lastRhythmCheckAt: state.clinical.lastRhythmCheckAt,
    team: state.team.members,
    pendingOrders: state.orders.orders.filter(o => {
      if (!isOrderTerminal(o.status)) return true;
      const t = o.schedule.terminalAt;
      return t !== null && state.clock - t < TERMINAL_DISPLAY_SECONDS;
    }),
    recentLog: recent,
    chaosFiredCount: findEvents(state.replay, e => e.eventType === 'scenario.chaos.fired').length,
    scoreReport: state.score,
    reversibles: state.clinical.reversibles,
    hasUltrasound: state.clinical.hasUltrasound,
    workingDiagnosis: state.clinical.workingDiagnosis,
    investigationCount: state.clinical.investigationCount,
    inappropriateInvestigations: state.clinical.inappropriateInvestigations,
  };
}
