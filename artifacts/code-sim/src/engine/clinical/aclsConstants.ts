import type { Rhythm } from '../types/core';

export const RHYTHM_CHECK_INTERVAL_SECONDS = 120;
export const RHYTHM_CHECK_GRACE_SECONDS = 10;

export const EPI_MIN_INTERVAL_SECONDS = 180;
export const EPI_MAX_INTERVAL_SECONDS = 300;
export const EPI_WARNING_LEAD_SECONDS = 10;

export const AMIODARONE_FIRST_DOSE_MG = 300;
export const AMIODARONE_SUBSEQUENT_DOSE_MG = 150;

export const CPR_CYCLE_DURATION = 120;
export const SHOCK_JOULES = 200;
export const COMPRESSOR_SWAP_INTERVAL = 120;

export const RHYTHM_CHECK_INTERVAL = RHYTHM_CHECK_INTERVAL_SECONDS;
export const EPI_MIN_INTERVAL = EPI_MIN_INTERVAL_SECONDS;
export const EPI_MAX_INTERVAL = EPI_MAX_INTERVAL_SECONDS;

export const SHOCKABLE_RHYTHMS: Rhythm[] = ['vfib', 'vtach'];
export const NON_SHOCKABLE_ARREST_RHYTHMS: Rhythm[] = ['pea', 'asystole'];
export const ROSC_RHYTHMS: Rhythm[] = ['sinus', 'sinus_brady', 'sinus_tachy'];

export function isShockable(r: Rhythm): boolean {
  return SHOCKABLE_RHYTHMS.includes(r);
}

export function isArrestRhythm(r: Rhythm): boolean {
  return SHOCKABLE_RHYTHMS.includes(r) || NON_SHOCKABLE_ARREST_RHYTHMS.includes(r);
}

export function isPerfusing(r: Rhythm): boolean {
  return ROSC_RHYTHMS.includes(r);
}
