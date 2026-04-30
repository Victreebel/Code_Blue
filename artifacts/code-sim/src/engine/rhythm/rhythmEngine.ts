import type { Rhythm } from '../types/core';
import type { RhythmState } from '../types/rhythm';
import type { ReplayState } from '../types/replay';
import { append } from '../replay/replayEngine';
import { isPerfusing, isShockable, ROSC_RHYTHMS } from '../clinical/aclsConstants';
import { draw, drawChoice, type RngState } from '../rng';

export function initRhythmState(initial: Rhythm, clock: number): RhythmState {
  return {
    current: initial,
    pulsePresent: isPerfusing(initial),
    lastTransitionAt: clock,
    shockableEpisodeStart: isShockable(initial) ? clock : null,
  };
}

function transition(
  rhythm: RhythmState,
  clock: number,
  to: Rhythm,
  replay: ReplayState,
  reason: string,
): { rhythm: RhythmState; replay: ReplayState } {
  if (rhythm.current === to) return { rhythm, replay };
  const next: RhythmState = {
    current: to,
    pulsePresent: isPerfusing(to),
    lastTransitionAt: clock,
    shockableEpisodeStart: isShockable(to) ? clock : null,
  };
  const nextReplay = append(replay, clock, 'rhythm', 'rhythm.transition', {
    from: rhythm.current,
    to,
    reason,
  });
  return { rhythm: next, replay: nextReplay };
}

export interface ShockOutcomeInput {
  rhythm: RhythmState;
  replay: ReplayState;
  rng: RngState;
  clock: number;
  shockNumberThisCode: number;
  hadEpiBeforeShock: boolean;
  hadAmiodaroneBeforeShock: boolean;
  cprQualityFactor: number;
}

export interface ShockOutcomeOutput {
  rhythm: RhythmState;
  replay: ReplayState;
  rng: RngState;
  achievedRosc: boolean;
}

export function applyShock(input: ShockOutcomeInput): ShockOutcomeOutput {
  let { rhythm, replay, rng, clock } = input;

  if (!isShockable(rhythm.current)) {
    replay = append(replay, clock, 'rhythm', 'rhythm.shock.no_change', {
      reason: 'rhythm_not_shockable',
      rhythm: rhythm.current,
    });
    return { rhythm, replay, rng, achievedRosc: false };
  }

  let baseRosc = 0.18;
  baseRosc += Math.min(input.shockNumberThisCode, 4) * 0.07;
  if (input.hadEpiBeforeShock) baseRosc += 0.12;
  if (input.hadAmiodaroneBeforeShock) baseRosc += 0.1;
  baseRosc += input.cprQualityFactor * 0.15;
  baseRosc = Math.min(0.85, baseRosc);

  const [roll, rng1] = draw(rng);
  rng = rng1;

  if (roll < baseRosc) {
    const [pickedRosc, rng2] = drawChoice(rng, ROSC_RHYTHMS);
    rng = rng2;
    const result = transition(rhythm, clock, pickedRosc, replay, 'shock_rosc');
    rhythm = result.rhythm;
    replay = append(result.replay, clock, 'rhythm', 'rhythm.rosc', {
      rhythm: pickedRosc,
      shockNumber: input.shockNumberThisCode,
    });
    return { rhythm, replay, rng, achievedRosc: true };
  }

  const [conv, rng3] = draw(rng);
  rng = rng3;
  const conversionChance = 0.4 + input.cprQualityFactor * 0.2;
  if (conv < conversionChance && rhythm.current === 'vfib') {
    const [pick, rng4] = draw(rng);
    rng = rng4;
    const next: Rhythm = pick < 0.55 ? 'pea' : 'asystole';
    const r = transition(rhythm, clock, next, replay, 'shock_to_nonshockable');
    return { rhythm: r.rhythm, replay: r.replay, rng, achievedRosc: false };
  }

  if (rhythm.current === 'vtach' && conv < conversionChance) {
    const r = transition(rhythm, clock, 'vfib', replay, 'shock_destabilization');
    return { rhythm: r.rhythm, replay: r.replay, rng, achievedRosc: false };
  }

  replay = append(replay, clock, 'rhythm', 'rhythm.shock.no_change', {
    reason: 'persistent_shockable',
    rhythm: rhythm.current,
  });
  return { rhythm, replay, rng, achievedRosc: false };
}

export interface RhythmTickInput {
  rhythm: RhythmState;
  replay: ReplayState;
  rng: RngState;
  clock: number;
  cprActive: boolean;
  hasAdvancedAirway: boolean;
  secondsSinceLastEpi: number | null;
  shockCount: number;
}

export interface RhythmTickOutput {
  rhythm: RhythmState;
  replay: ReplayState;
  rng: RngState;
}

export function stepRhythm(input: RhythmTickInput): RhythmTickOutput {
  let { rhythm, replay, rng } = input;
  const dwellSeconds = input.clock - rhythm.lastTransitionAt;

  if (rhythm.current === 'vtach' && dwellSeconds >= 30 && input.shockCount === 0) {
    const [roll, ns] = draw(rng);
    rng = ns;
    if (roll < 0.05) {
      const r = transition(rhythm, input.clock, 'vfib', replay, 'spontaneous_degeneration');
      return { rhythm: r.rhythm, replay: r.replay, rng };
    }
  }

  if (
    rhythm.current === 'vfib' &&
    !input.cprActive &&
    dwellSeconds >= 90
  ) {
    const [roll, ns] = draw(rng);
    rng = ns;
    if (roll < 0.04) {
      const r = transition(rhythm, input.clock, 'asystole', replay, 'untreated_decay');
      return { rhythm: r.rhythm, replay: r.replay, rng };
    }
  }

  return { rhythm, replay, rng };
}
