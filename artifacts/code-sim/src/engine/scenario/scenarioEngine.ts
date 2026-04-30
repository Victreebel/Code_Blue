import type { ScenarioInput, ScenarioState } from '../types/scenario';
import type { ReplayState } from '../types/replay';
import { append } from '../replay/replayEngine';

export function initScenarioState(input: ScenarioInput): ScenarioState {
  return {
    id: input.scenarioId,
    seed: input.seed,
    realTimeBudget: input.realTimeBudget,
    scheduledChaos: input.scheduledChaos.map(c => ({ ...c, fired: false, firedAt: null })),
    ended: false,
    outcome: null,
    endedAt: null,
  };
}

export interface ScenarioStepInput {
  scenario: ScenarioState;
  replay: ReplayState;
  clock: number;
  medicationOrderedThisTick: boolean;
}

export interface ScenarioStepOutput {
  scenario: ScenarioState;
  replay: ReplayState;
  firedChaos: Array<{ type: string; payload?: Record<string, number> }>;
}

export function stepScenario(input: ScenarioStepInput): ScenarioStepOutput {
  let scenario = input.scenario;
  let replay = input.replay;
  const fired: ScenarioStepOutput['firedChaos'] = [];

  if (scenario.ended) {
    return { scenario, replay, firedChaos: fired };
  }

  let updated = false;
  const nextChaos = scenario.scheduledChaos.map(c => {
    if (c.fired) return c;
    if (c.triggerKind === 'time' && c.triggerAtSeconds !== undefined && input.clock >= c.triggerAtSeconds) {
      fired.push({ type: c.type, payload: c.payload });
      replay = append(replay, input.clock, 'scenario', 'scenario.chaos.fired', { chaosType: c.type, scheduledAt: c.triggerAtSeconds });
      updated = true;
      return { ...c, fired: true, firedAt: input.clock };
    }
    if (c.triggerKind === 'on_first_medication' && input.medicationOrderedThisTick) {
      fired.push({ type: c.type, payload: c.payload });
      replay = append(replay, input.clock, 'scenario', 'scenario.chaos.fired', { chaosType: c.type, triggeredBy: 'first_medication' });
      updated = true;
      return { ...c, fired: true, firedAt: input.clock };
    }
    return c;
  });

  if (updated) {
    scenario = { ...scenario, scheduledChaos: nextChaos };
  }

  return { scenario, replay, firedChaos: fired };
}

export function endScenario(
  scenario: ScenarioState,
  replay: ReplayState,
  clock: number,
  outcome: ScenarioState['outcome'],
): { scenario: ScenarioState; replay: ReplayState } {
  if (scenario.ended) return { scenario, replay };
  const next: ScenarioState = { ...scenario, ended: true, outcome, endedAt: clock };
  const nextReplay = append(replay, clock, 'scenario', 'scenario.ended', { outcome });
  return { scenario: next, replay: nextReplay };
}
