import { type Rhythm, type MedicationType, SHOCKABLE_RHYTHMS } from './types';

export const RHYTHM_CHECK_INTERVAL = 120;
export const EPI_MIN_INTERVAL = 180;
export const EPI_MAX_INTERVAL = 300;
export const CPR_CYCLE_DURATION = 120;
export const SHOCK_JOULES = 200;
export const COMPRESSOR_SWAP_INTERVAL = 120;

export function isShockable(rhythm: Rhythm): boolean {
  return SHOCKABLE_RHYTHMS.includes(rhythm);
}

export function getRecommendedMedications(rhythm: Rhythm, shockCount: number, amiodaroneDoses: number): { med: MedicationType; dose: string; priority: number }[] {
  const meds: { med: MedicationType; dose: string; priority: number }[] = [];
  meds.push({ med: 'epinephrine', dose: '1mg IV/IO', priority: 1 });
  if (isShockable(rhythm)) {
    if (shockCount >= 1 && amiodaroneDoses === 0) {
      meds.push({ med: 'amiodarone', dose: '300mg IV/IO', priority: 2 });
    } else if (amiodaroneDoses === 1) {
      meds.push({ med: 'amiodarone', dose: '150mg IV/IO', priority: 2 });
    }
  }
  return meds;
}

export function getHRForRhythm(rhythm: Rhythm): number {
  switch (rhythm) {
    case 'vfib': return 0;
    case 'vtach': return 0;
    case 'pea': return Math.floor(Math.random() * 40 + 20);
    case 'asystole': return 0;
    case 'sinus': return Math.floor(Math.random() * 30 + 70);
    case 'sinus_brady': return Math.floor(Math.random() * 20 + 40);
    case 'sinus_tachy': return Math.floor(Math.random() * 30 + 100);
  }
}

export function getBPForRhythm(rhythm: Rhythm): { systolic: number; diastolic: number } {
  switch (rhythm) {
    case 'vfib': case 'vtach': case 'asystole':
      return { systolic: 0, diastolic: 0 };
    case 'pea':
      return { systolic: 0, diastolic: 0 };
    case 'sinus':
      return { systolic: Math.floor(Math.random() * 30 + 100), diastolic: Math.floor(Math.random() * 15 + 60) };
    case 'sinus_brady':
      return { systolic: Math.floor(Math.random() * 20 + 80), diastolic: Math.floor(Math.random() * 10 + 50) };
    case 'sinus_tachy':
      return { systolic: Math.floor(Math.random() * 20 + 90), diastolic: Math.floor(Math.random() * 10 + 55) };
  }
}

export function getSpO2ForRhythm(rhythm: Rhythm, hasAirway: boolean, cprInProgress: boolean): number {
  if (rhythm === 'sinus' || rhythm === 'sinus_brady' || rhythm === 'sinus_tachy') {
    return Math.floor(Math.random() * 5 + 93);
  }
  if (cprInProgress && hasAirway) return Math.floor(Math.random() * 15 + 75);
  if (cprInProgress) return Math.floor(Math.random() * 20 + 60);
  return Math.floor(Math.random() * 10 + 30);
}

export function getEtCO2(cprInProgress: boolean, cprQuality: number, isROSC: boolean): number {
  if (isROSC) return Math.floor(Math.random() * 10 + 35);
  if (cprInProgress) return Math.floor(cprQuality * 30 + Math.random() * 10 + 10);
  return Math.floor(Math.random() * 5 + 5);
}

export interface ProtocolViolation {
  type: string;
  message: string;
  severity: 'minor' | 'major' | 'critical';
  penalty: number;
}

export function checkProtocolViolations(
  elapsed: number,
  lastRhythmCheck: number,
  lastEpi: number,
  rhythm: Rhythm,
  lastShock: number,
  cprInProgress: boolean,
  hasIV: boolean,
): ProtocolViolation[] {
  const violations: ProtocolViolation[] = [];
  const timeSinceRhythmCheck = elapsed - lastRhythmCheck;
  if (timeSinceRhythmCheck > CPR_CYCLE_DURATION + 30) {
    violations.push({
      type: 'late_rhythm_check',
      message: `Rhythm check overdue (${Math.floor(timeSinceRhythmCheck)}s since last)`,
      severity: timeSinceRhythmCheck > CPR_CYCLE_DURATION + 60 ? 'major' : 'minor',
      penalty: timeSinceRhythmCheck > CPR_CYCLE_DURATION + 60 ? -15 : -5,
    });
  }
  if (hasIV && lastEpi > 0 && elapsed - lastEpi > EPI_MAX_INTERVAL + 30) {
    violations.push({
      type: 'late_epinephrine',
      message: `Epinephrine overdue (${Math.floor(elapsed - lastEpi)}s since last dose)`,
      severity: 'major',
      penalty: -10,
    });
  }
  if (isShockable(rhythm) && !cprInProgress && elapsed - lastShock > 10 && lastShock < lastRhythmCheck) {
    violations.push({
      type: 'delayed_shock',
      message: 'Shockable rhythm identified but defibrillation delayed',
      severity: 'critical',
      penalty: -20,
    });
  }
  if (!cprInProgress && elapsed > 10 && !['sinus', 'sinus_brady', 'sinus_tachy'].includes(rhythm)) {
    violations.push({
      type: 'no_cpr',
      message: 'CPR not in progress during cardiac arrest',
      severity: 'critical',
      penalty: -25,
    });
  }
  return violations;
}
