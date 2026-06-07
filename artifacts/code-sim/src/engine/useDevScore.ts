import { useEffect, useRef, useState } from 'react';
import { computeSchemeE } from './scoring/schemeE';
import type { ScoreReport, ScoreBucketId } from './types/score';
import type { ReplayState } from './types/replay';
import type { ScenarioState } from './types/scenario';

export interface ScoringDelta {
  id: string;
  bucketId: ScoreBucketId;
  bucketLabel: string;
  delta: number;
  reason: string;
  clockTimestamp: number;
}

export interface DevScoreState {
  current: ScoreReport;
  log: ScoringDelta[];
}

let deltaCounter = 0;
function nextDeltaId() {
  return `d${++deltaCounter}`;
}

export function useDevScore(
  replay: ReplayState | null,
  scenario: ScenarioState | null,
  clock: number,
): DevScoreState | null {
  // Keep clock in a ref so the event-triggered effect can read the latest
  // value without clock itself being a dependency (avoids per-tick diffs).
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const prevReportRef = useRef<ScoreReport | null>(null);
  const [state, setState] = useState<DevScoreState | null>(null);

  // The event count is the only trigger — we diff only when a new event
  // is appended to the replay, not on every engine clock tick.
  const eventCount = replay?.events.length ?? 0;

  useEffect(() => {
    if (!replay || !scenario) {
      prevReportRef.current = null;
      setState(null);
      return;
    }

    // Use the clock value captured at the moment a new event arrived.
    const snapshotClock = clockRef.current;
    const current = computeSchemeE(replay, scenario, snapshotClock);
    const prev = prevReportRef.current;

    const newDeltas: ScoringDelta[] = [];

    if (prev !== null) {
      for (const bucket of current.buckets) {
        const prevBucket = prev.buckets.find(b => b.id === bucket.id);
        if (!prevBucket) continue;
        const delta = bucket.awarded - prevBucket.awarded;
        if (delta !== 0) {
          const newReasons = bucket.reasons.filter(r => !prevBucket.reasons.includes(r));
          const reason =
            newReasons[0] ?? (delta > 0 ? `+${delta} points` : `${delta} points`);
          newDeltas.push({
            id: nextDeltaId(),
            bucketId: bucket.id,
            bucketLabel: bucket.label,
            delta,
            reason,
            clockTimestamp: snapshotClock,
          });
        }
      }
    }

    prevReportRef.current = current;

    setState(prev => {
      const prevLog = prev?.log ?? [];
      return {
        current,
        log: newDeltas.length > 0 ? [...prevLog, ...newDeltas] : prevLog,
      };
    });
  // Only re-run when the replay event list grows — never on clock ticks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCount, scenario, replay]);

  return state;
}
