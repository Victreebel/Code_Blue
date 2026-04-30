import type { Rhythm } from '../types/core';

export const RHYTHM_CHECK_INTERVAL = 120;
export const EPI_MIN_INTERVAL = 180;
export const EPI_MAX_INTERVAL = 300;
export const CPR_CYCLE_DURATION = 120;
export const SHOCK_JOULES = 200;
export const COMPRESSOR_SWAP_INTERVAL = 120;

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
