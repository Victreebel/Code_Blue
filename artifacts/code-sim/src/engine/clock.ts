export const STEP_SECONDS = 0.1;

export interface ClockAccumulator {
  carryMs: number;
  lastWallMs: number | null;
}

export function createAccumulator(): ClockAccumulator {
  return { carryMs: 0, lastWallMs: null };
}

export function pollSteps(acc: ClockAccumulator, nowMs: number): { steps: number; nextAcc: ClockAccumulator } {
  if (acc.lastWallMs === null) {
    return { steps: 0, nextAcc: { carryMs: 0, lastWallMs: nowMs } };
  }
  const dtMs = Math.max(0, nowMs - acc.lastWallMs);
  const totalMs = acc.carryMs + dtMs;
  const stepMs = STEP_SECONDS * 1000;
  const steps = Math.floor(totalMs / stepMs);
  const carryMs = totalMs - steps * stepMs;
  return { steps, nextAcc: { carryMs, lastWallMs: nowMs } };
}
