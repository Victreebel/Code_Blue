import type { Rhythm, ChaosEventType, StaffType, Competence, Compliance, TeamRole } from './core';

export interface BehaviorProfile {
  initiative: number;
  distractibility: number;
  clarificationTendency: number;
  executionSpeed: number;
  assertiveness: number;
}

export type StaffArchetypeId =
  | 'experienced_nurse' | 'hesitant_new_nurse' | 'reliable_rt'
  | 'delayed_rt' | 'eager_intern' | 'distractible_intern'
  | 'efficient_pharmacist' | 'interfering_senior';

export interface ScenarioMember {
  id: string;
  name: string;
  staffType: StaffType;
  archetypeId: StaffArchetypeId;
  competence: Competence;
  compliance: Compliance;
  behavior: BehaviorProfile;
  initialRole: TeamRole;
  isLeader: boolean;
}

export interface ScheduledChaos {
  type: ChaosEventType;
  triggerKind: 'time' | 'on_first_medication';
  triggerAtSeconds?: number;
  payload?: Record<string, number>;
}

export interface ScenarioInput {
  scenarioId: string;
  seed: string;
  initialRhythm: Rhythm;
  realTimeBudget: { minSeconds: number; maxSeconds: number };
  patientName: string;
  patientAge: number;
  patientSex: 'M' | 'F';
  patientWeight: number;
  chiefComplaint: string;
  pmh: string[];
  briefingText: string;
  team: ScenarioMember[];
  scheduledChaos: ScheduledChaos[];
  roomCapacity: number;
}

export interface ScenarioState {
  id: string;
  seed: string;
  realTimeBudget: { minSeconds: number; maxSeconds: number };
  scheduledChaos: Array<ScheduledChaos & { fired: boolean; firedAt: number | null }>;
  ended: boolean;
  outcome: 'rosc' | 'time_of_death' | 'budget_exceeded' | null;
  endedAt: number | null;
}
