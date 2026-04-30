import type { Rhythm } from './core';

export interface RhythmState {
  current: Rhythm;
  pulsePresent: boolean;
  lastTransitionAt: number;
  shockableEpisodeStart: number | null;
}
