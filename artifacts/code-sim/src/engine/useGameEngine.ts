import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  initSimulationState,
  startSimulation,
  tickOnce,
  dispatchUserAction,
  finalizeAndScore,
  type SimulationState,
  type UserAction,
} from './index';
import { selectUIState, type UIState } from './ui/uiStateEngine';
import { buildWitnessedVfArrest } from './scenario/witnessedVfArrest';
import { createAccumulator, pollSteps } from './clock';
import type { TeamRole, MedicationType } from './types/core';
import type { ScenarioInput } from './types/scenario';

type Phase = SimulationState['phase'] | 'menu';

interface MenuState {
  kind: 'menu';
  scenarioInput: null;
  state: null;
}

interface ActiveState {
  kind: 'sim';
  scenarioInput: ScenarioInput;
  state: SimulationState;
}

type EngineWrapperState = MenuState | ActiveState;

type EngineEvent =
  | { kind: 'init'; scenarioInput: ScenarioInput }
  | { kind: 'replace'; state: SimulationState }
  | { kind: 'reset' };

function reducer(prev: EngineWrapperState, ev: EngineEvent): EngineWrapperState {
  if (ev.kind === 'init') {
    const sim = initSimulationState(ev.scenarioInput);
    return { kind: 'sim', scenarioInput: ev.scenarioInput, state: sim };
  }
  if (ev.kind === 'reset') {
    return { kind: 'menu', scenarioInput: null, state: null };
  }
  if (prev.kind !== 'sim') return prev;
  return { ...prev, state: ev.state };
}

const INITIAL: EngineWrapperState = { kind: 'menu', scenarioInput: null, state: null };

/**
 * Engine actions. The UI-facing CommandPanel uses ONLY the §12 MVP subset:
 *   startCpr, switchCompressor, chargeDefib, shock, medication (epi/amio),
 *   rhythmCheck, pulseCheck, airwayBvm, requestClosedLoop.
 * The remaining methods (pauseCpr, ivAccess, ioAccess, airwayAdvanced,
 * announceCycle, declareRosc, callTimeOfDeath) are @internal — retained so
 * the headless `replay()` API and scripted tests can drive every action the
 * engine supports, but NOT exposed in the active-play UI.
 */
export interface EngineActions {
  startGame: (seed?: string) => void;
  beginCode: () => void;
  resetToMenu: () => void;
  viewDebrief: () => void;
  assignRole: (memberId: string, role: TeamRole) => void;
  confirmRole: (memberId: string) => void;

  // §12 MVP action surface (used by CommandPanel)
  startCpr: () => void;
  assignCompressor: () => void;
  switchCompressor: () => void;
  chargeDefib: () => void;
  shock: () => void;
  medication: (med: MedicationType, doseMg: number) => void;
  rhythmCheck: () => void;
  pulseCheck: () => void;
  airwayBvm: () => void;
  requestClosedLoop: (orderId: string) => void;

  /** @internal — engine/test only, not exposed in UI */
  pauseCpr: () => void;
  /** @internal */
  ivAccess: () => void;
  /** @internal */
  ioAccess: () => void;
  /** @internal */
  airwayAdvanced: () => void;
  /** @internal */
  announceCycle: () => void;
  /** @internal — gated; emits user.declare_rosc only */
  declareRosc: () => void;
  /** @internal */
  callTimeOfDeath: () => void;

  /** Identify a reversible cause (H's & T's) — UI only, no engine action */
  identifyCause: (causeId: string) => void;
  /** Initiate treatment of identified reversible cause — UI only, no engine action */
  treatCause: (causeId: string) => void;
}

export interface UseGameEngineResult {
  ui: UIState | null;
  phase: Phase;
  actions: EngineActions;
  scenarioInput: ScenarioInput | null;
  rawState: SimulationState | null;
}

export function useGameEngine(): UseGameEngineResult {
  const [wrapper, dispatch] = useReducer(reducer, INITIAL);
  const stateRef = useRef<SimulationState | null>(null);
  stateRef.current = wrapper.kind === 'sim' ? wrapper.state : null;
  const accRef = useRef(createAccumulator());

  const dispatchAction = useCallback((act: UserAction) => {
    if (!stateRef.current) return;
    const next = dispatchUserAction(stateRef.current, act);
    stateRef.current = next;
    dispatch({ kind: 'replace', state: next });
  }, []);

  const startGame = useCallback((seed?: string) => {
    const seedStr = seed && seed.length > 0 ? seed : `code_${Date.now()}`;
    const input = buildWitnessedVfArrest(seedStr);
    accRef.current = createAccumulator();
    dispatch({ kind: 'init', scenarioInput: input });
  }, []);

  const beginCode = useCallback(() => {
    if (!stateRef.current) return;
    accRef.current = createAccumulator();
    const next = startSimulation(stateRef.current);
    stateRef.current = next;
    dispatch({ kind: 'replace', state: next });
  }, []);

  const resetToMenu = useCallback(() => {
    accRef.current = createAccumulator();
    dispatch({ kind: 'reset' });
  }, []);

  const viewDebrief = useCallback(() => {
    if (!stateRef.current) return;
    const next = finalizeAndScore(stateRef.current);
    stateRef.current = next;
    dispatch({ kind: 'replace', state: next });
  }, []);

  useEffect(() => {
    if (wrapper.kind !== 'sim') return;
    if (wrapper.state.phase !== 'active') return;
    let raf: number | null = null;
    const loop = (t: number) => {
      const polled = pollSteps(accRef.current, t);
      accRef.current = polled.nextAcc;
      if (polled.steps > 0 && stateRef.current) {
        let next = stateRef.current;
        for (let i = 0; i < polled.steps; i++) {
          if (next.phase !== 'active') break;
          next = tickOnce(next);
        }
        if (next !== stateRef.current) {
          stateRef.current = next;
          dispatch({ kind: 'replace', state: next });
        }
      }
      if (stateRef.current && stateRef.current.phase === 'active') {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [wrapper.kind === 'sim' ? wrapper.state.phase : 'menu']);

  const actions: EngineActions = {
    startGame,
    beginCode,
    resetToMenu,
    viewDebrief,
    assignRole: (memberId, role) => dispatchAction({ kind: 'assign_role', memberId, role }),
    confirmRole: (memberId) => dispatchAction({ kind: 'confirm_role', memberId }),
    startCpr: () => dispatchAction({ kind: 'order_cpr_start' }),
    assignCompressor: () => dispatchAction({ kind: 'assign_compressor' }),
    pauseCpr: () => dispatchAction({ kind: 'order_cpr_pause' }),
    rhythmCheck: () => dispatchAction({ kind: 'order_rhythm_check' }),
    pulseCheck: () => dispatchAction({ kind: 'order_pulse_check' }),
    chargeDefib: () => dispatchAction({ kind: 'order_charge_defib' }),
    shock: () => dispatchAction({ kind: 'order_shock' }),
    ivAccess: () => dispatchAction({ kind: 'order_iv_access' }),
    ioAccess: () => dispatchAction({ kind: 'order_io_access' }),
    airwayBvm: () => dispatchAction({ kind: 'order_airway_bvm' }),
    airwayAdvanced: () => dispatchAction({ kind: 'order_airway_advanced' }),
    medication: (med, doseMg) => dispatchAction({ kind: 'order_medication', medication: med, doseMg }),
    switchCompressor: () => dispatchAction({ kind: 'order_compressor_switch' }),
    announceCycle: () => dispatchAction({ kind: 'order_announce_cycle' }),
    requestClosedLoop: (orderId) => dispatchAction({ kind: 'request_closed_loop', orderId }),
    callTimeOfDeath: () => dispatchAction({ kind: 'call_time_of_death' }),
    declareRosc: () => dispatchAction({ kind: 'declare_rosc' }),
    identifyCause: (_causeId: string) => { /* UI tracking only */ },
    treatCause: (_causeId: string) => { /* UI tracking only */ },
  };

  const ui = wrapper.kind === 'sim' ? selectUIState(wrapper.state) : null;
  const phase: Phase = wrapper.kind === 'sim' ? wrapper.state.phase : 'menu';
  return { ui, phase, actions, scenarioInput: wrapper.scenarioInput, rawState: wrapper.kind === 'sim' ? wrapper.state : null };
}
