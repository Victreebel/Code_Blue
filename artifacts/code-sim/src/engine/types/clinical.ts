import type { MedicationType } from './core';

export interface CprInterval {
  startedAt: number;
  endedAt: number | null;
  compressorId: string | null;
}

export interface MedicationDose {
  type: MedicationType;
  doseMg: number;
  givenAt: number;
}

export interface ClinicalState {
  cprActive: boolean;
  cprIntervals: CprInterval[];
  defibCharged: boolean;
  defibChargedAt: number | null;
  shockCount: number;
  lastShockAt: number | null;
  hasIVAccess: boolean;
  hasIOAccess: boolean;
  hasAdvancedAirway: boolean;
  ivPlacedAt: number | null;
  airwayPlacedAt: number | null;
  lastRhythmCheckAt: number | null;
  lastPulseCheckAt: number | null;
  lastEpiAt: number | null;
  amiodaroneDoses: number;
  medications: MedicationDose[];
  cyclesAnnounced: number;
  closedLoopRequests: number;
  closedLoopSatisfied: number;
  lastCompressorSwitchAt: number | null;
  currentCompressorId: string | null;
  pendingChaosMedDelayUntil: number | null;
}
