import type { PhysiologyState } from '../types/physiology';
import type { RhythmState } from '../types/rhythm';
import type { ClinicalState } from '../types/clinical';
import type { ReplayState } from '../types/replay';
import { append } from '../replay/replayEngine';
import { isShockable } from '../clinical/aclsConstants';

export function initPhysiology(rhythm: RhythmState): PhysiologyState {
  if (isShockable(rhythm.current)) {
    return { hr: 0, sysBP: 0, diaBP: 0, spo2: 84, etco2: 12, etco2Trend: [], perfusionIndex: 0 };
  }
  if (rhythm.current === 'pea') {
    return { hr: 60, sysBP: 0, diaBP: 0, spo2: 80, etco2: 10, etco2Trend: [], perfusionIndex: 0 };
  }
  if (rhythm.current === 'asystole') {
    return { hr: 0, sysBP: 0, diaBP: 0, spo2: 75, etco2: 6, etco2Trend: [], perfusionIndex: 0 };
  }
  return { hr: 80, sysBP: 118, diaBP: 72, spo2: 96, etco2: 38, etco2Trend: [], perfusionIndex: 1 };
}

export interface PhysiologyTickInput {
  physiology: PhysiologyState;
  rhythm: RhythmState;
  clinical: ClinicalState;
  replay: ReplayState;
  clock: number;
}

export interface PhysiologyTickOutput {
  physiology: PhysiologyState;
  replay: ReplayState;
}

const TARGET_ROUND_DECIMALS = 1;

function r(value: number, decimals = TARGET_ROUND_DECIMALS): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

function approach(current: number, target: number, rate: number, dtSeconds: number): number {
  const k = 1 - Math.exp(-rate * dtSeconds);
  return current + (target - current) * k;
}

export function stepPhysiology(input: PhysiologyTickInput, dtSeconds: number): PhysiologyTickOutput {
  const { rhythm, clinical, clock } = input;
  let phys = input.physiology;
  let replay = input.replay;

  let targetHr = phys.hr;
  let targetSys = phys.sysBP;
  let targetDia = phys.diaBP;
  let targetSpo2 = phys.spo2;
  let targetEtco2 = phys.etco2;
  let targetPerfusion = phys.perfusionIndex;

  switch (rhythm.current) {
    case 'vfib':
    case 'vtach':
      targetHr = 0;
      targetSys = 0;
      targetDia = 0;
      targetPerfusion = 0;
      if (clinical.cprActive) {
        targetSys = 60;
        targetDia = 30;
        targetSpo2 = clinical.hasAdvancedAirway ? 92 : 86;
        targetEtco2 = clinical.hasAdvancedAirway ? 22 : 16;
        targetPerfusion = 0.4;
      } else {
        const downSec = Math.max(0, clock - rhythm.lastTransitionAt);
        const decay = Math.min(0.5, downSec * 0.005);
        targetSpo2 = Math.max(40, 84 - downSec * 0.3);
        targetEtco2 = Math.max(4, 12 - decay * 6);
      }
      break;
    case 'pea':
      targetHr = 50;
      targetSys = 0;
      targetDia = 0;
      targetPerfusion = 0;
      if (clinical.cprActive) {
        targetSys = 55;
        targetDia = 28;
        targetSpo2 = clinical.hasAdvancedAirway ? 90 : 84;
        targetEtco2 = clinical.hasAdvancedAirway ? 20 : 14;
        targetPerfusion = 0.35;
      } else {
        targetSpo2 = Math.max(35, phys.spo2 - 0.4);
        targetEtco2 = Math.max(4, phys.etco2 - 0.1);
      }
      break;
    case 'asystole':
      targetHr = 0;
      targetSys = 0;
      targetDia = 0;
      targetPerfusion = 0;
      if (clinical.cprActive) {
        targetSys = 50;
        targetDia = 25;
        targetSpo2 = clinical.hasAdvancedAirway ? 88 : 82;
        targetEtco2 = clinical.hasAdvancedAirway ? 18 : 12;
      } else {
        targetSpo2 = Math.max(30, phys.spo2 - 0.5);
        targetEtco2 = Math.max(2, phys.etco2 - 0.15);
      }
      break;
    case 'sinus':
      targetHr = 86;
      targetSys = 112;
      targetDia = 70;
      targetSpo2 = clinical.hasAdvancedAirway ? 99 : 96;
      targetEtco2 = 36;
      targetPerfusion = 1;
      break;
    case 'sinus_brady':
      targetHr = 52;
      targetSys = 102;
      targetDia = 64;
      targetSpo2 = clinical.hasAdvancedAirway ? 98 : 94;
      targetEtco2 = 34;
      targetPerfusion = 0.85;
      break;
    case 'sinus_tachy':
      targetHr = 116;
      targetSys = 124;
      targetDia = 78;
      targetSpo2 = clinical.hasAdvancedAirway ? 99 : 95;
      targetEtco2 = 38;
      targetPerfusion = 1;
      break;
  }

  const newHr = r(approach(phys.hr, targetHr, 0.5, dtSeconds));
  const newSys = r(approach(phys.sysBP, targetSys, 0.6, dtSeconds));
  const newDia = r(approach(phys.diaBP, targetDia, 0.6, dtSeconds));
  const newSpo2 = r(approach(phys.spo2, targetSpo2, 0.4, dtSeconds));
  const newEtco2 = r(approach(phys.etco2, targetEtco2, 0.3, dtSeconds));
  const newPerf = r(approach(phys.perfusionIndex, targetPerfusion, 0.5, dtSeconds), 2);

  const trend = [...phys.etco2Trend, newEtco2];
  if (trend.length > 60) trend.shift();

  const next: PhysiologyState = {
    hr: newHr,
    sysBP: newSys,
    diaBP: newDia,
    spo2: newSpo2,
    etco2: newEtco2,
    etco2Trend: trend,
    perfusionIndex: newPerf,
  };

  if (
    Math.abs(next.hr - phys.hr) >= 5 ||
    Math.abs(next.sysBP - phys.sysBP) >= 8 ||
    Math.abs(next.spo2 - phys.spo2) >= 3 ||
    Math.abs(next.etco2 - phys.etco2) >= 3
  ) {
    replay = append(replay, clock, 'physiology', 'physiology.update', {
      hr: next.hr,
      sysBP: next.sysBP,
      diaBP: next.diaBP,
      spo2: next.spo2,
      etco2: next.etco2,
    });
  }

  return { physiology: next, replay };
}
