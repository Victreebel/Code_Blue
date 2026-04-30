import type { ScenarioState } from './scenario';
import type { RhythmState } from './rhythm';
import type { PhysiologyState } from './physiology';
import type { TeamState } from './team';
import type { OrdersState } from './orders';
import type { ReplayState } from './replay';
import type { ClinicalState } from './clinical';
import type { ScoreReport } from './score';
import type { RngState } from '../rng';

export type Phase = 'menu' | 'briefing' | 'active' | 'paused' | 'ended' | 'debrief';

export interface SimulationState {
  scenario: ScenarioState;
  rhythm: RhythmState;
  physiology: PhysiologyState;
  team: TeamState;
  orders: OrdersState;
  clinical: ClinicalState;
  replay: ReplayState;
  score: ScoreReport | null;
  clock: number;
  rng: RngState;
  phase: Phase;
}
