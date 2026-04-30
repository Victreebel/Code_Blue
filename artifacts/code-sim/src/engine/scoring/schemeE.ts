import type { ScoreBucket, ScoreReport } from '../types/score';
import type { ReplayState, ReplayEvent } from '../types/replay';
import type { ScenarioState } from '../types/scenario';

interface BucketContext {
  events: ReplayEvent[];
  scenario: ScenarioState;
  endClock: number;
}

function findAll(events: ReplayEvent[], type: string): ReplayEvent[] {
  return events.filter(e => e.eventType === type);
}

function first(events: ReplayEvent[], type: string): ReplayEvent | null {
  for (const e of events) if (e.eventType === type) return e;
  return null;
}

// "Effective" completions include both on-time completions and delayed
// terminal events — the action did happen for clinical purposes.
// Wrong-recipient and failed events are NOT effective completions.
function effectiveCompletions(events: ReplayEvent[]): ReplayEvent[] {
  return events.filter(
    e => e.eventType === 'pendingOrder.completed' || e.eventType === 'pendingOrder.delayed',
  );
}

function num(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function bucketAclsTiming({ events, scenario }: BucketContext): ScoreBucket {
  const max = 15;
  const reasons: string[] = [];
  const parts: string[] = [];
  let awarded = 0;

  const cprStartFinal = effectiveCompletions(events).find(e => e.payload.type === 'cpr_start');
  const cprStartTs = cprStartFinal ? cprStartFinal.timestamp : null;
  const cprIssued = findAll(events, 'pendingOrder.issued').find(e => e.payload.type === 'cpr_start');
  const earliestCprActivity = cprStartTs ?? (cprIssued ? cprIssued.timestamp : null);

  if (earliestCprActivity !== null && earliestCprActivity <= 30) {
    parts.push('5 (CPR ≤30s)');
    reasons.push(`CPR initiated at ${earliestCprActivity.toFixed(0)}s — within 30s target.`);
    awarded += 5;
  } else if (earliestCprActivity !== null && earliestCprActivity <= 60) {
    parts.push('3 (CPR ≤60s)');
    reasons.push(`CPR initiated at ${earliestCprActivity.toFixed(0)}s — late but within 60s.`);
    awarded += 3;
  } else if (earliestCprActivity !== null) {
    parts.push(`0 (CPR @${earliestCprActivity.toFixed(0)}s)`);
    reasons.push(`CPR initiated at ${earliestCprActivity.toFixed(0)}s — significantly delayed.`);
  } else {
    parts.push('0 (no CPR)');
    reasons.push('CPR was never initiated during the code.');
  }

  const firstShockEvent = effectiveCompletions(events).find(e => e.payload.type === 'shock');
  if (firstShockEvent && firstShockEvent.timestamp <= 120) {
    parts.push('5 (1st shock ≤2min)');
    reasons.push(`First shock at ${firstShockEvent.timestamp.toFixed(0)}s — within 2 minute target.`);
    awarded += 5;
  } else if (firstShockEvent && firstShockEvent.timestamp <= 180) {
    parts.push('2 (1st shock ≤3min)');
    reasons.push(`First shock at ${firstShockEvent.timestamp.toFixed(0)}s — late.`);
    awarded += 2;
  } else if (firstShockEvent) {
    parts.push(`0 (1st shock @${firstShockEvent.timestamp.toFixed(0)}s)`);
    reasons.push(`First shock at ${firstShockEvent.timestamp.toFixed(0)}s — significantly delayed.`);
  } else {
    parts.push('0 (no shock)');
    reasons.push('No defibrillation delivered for shockable rhythm.');
  }

  const rhythmChecks = effectiveCompletions(events).filter(e => e.payload.type === 'rhythm_check');
  let intervalScore = 5;
  let intervalDetail = '5 (intervals)';
  if (rhythmChecks.length === 0) {
    intervalScore = 0;
    intervalDetail = '0 (no rhythm checks)';
    reasons.push('No rhythm checks performed.');
  } else {
    const intervals: number[] = [];
    let prev = 0;
    for (const rc of rhythmChecks) {
      intervals.push(rc.timestamp - prev);
      prev = rc.timestamp;
    }
    const offCount = intervals.filter(i => i > 130 || (i < 110 && intervals.indexOf(i) > 0)).length;
    intervalScore = Math.max(0, 5 - offCount * 2);
    intervalDetail = `${intervalScore} (${rhythmChecks.length} checks, ${offCount} off-cadence)`;
    reasons.push(`${rhythmChecks.length} rhythm checks performed; ${offCount} off the 2-minute cadence.`);
  }
  parts.push(intervalDetail);
  awarded += intervalScore;

  return {
    id: 'acls_timing',
    label: 'ACLS Timing',
    max,
    awarded: Math.min(max, awarded),
    arithmetic: parts.join(' + ') + ` = ${Math.min(max, awarded)}/${max}`,
    reasons,
  };
}

function bucketCprContinuity({ events, endClock }: BucketContext): ScoreBucket {
  const max = 20;
  const reasons: string[] = [];
  const parts: string[] = [];

  const startEvents = effectiveCompletions(events).filter(e => e.payload.type === 'cpr_start');
  const pauseEvents = effectiveCompletions(events).filter(e => e.payload.type === 'cpr_pause');
  const intervals: Array<{ start: number; end: number }> = [];
  let activeStart: number | null = null;
  const merged = [
    ...startEvents.map(e => ({ ts: e.timestamp, kind: 'start' as const })),
    ...pauseEvents.map(e => ({ ts: e.timestamp, kind: 'pause' as const })),
  ].sort((a, b) => a.ts - b.ts);
  for (const m of merged) {
    if (m.kind === 'start' && activeStart === null) activeStart = m.ts;
    if (m.kind === 'pause' && activeStart !== null) {
      intervals.push({ start: activeStart, end: m.ts });
      activeStart = null;
    }
  }
  if (activeStart !== null) intervals.push({ start: activeStart, end: endClock });

  const totalCpr = intervals.reduce((s, i) => s + (i.end - i.start), 0);
  const fraction = endClock > 0 ? totalCpr / endClock : 0;

  let fracScore = 0;
  if (fraction >= 0.8) fracScore = 12;
  else if (fraction >= 0.6) fracScore = 8;
  else if (fraction >= 0.4) fracScore = 4;
  parts.push(`${fracScore} (fraction ${(fraction * 100).toFixed(0)}%)`);
  reasons.push(`Compression fraction: ${(fraction * 100).toFixed(1)}% (${totalCpr.toFixed(0)}s of ${endClock.toFixed(0)}s).`);

  const longPauses: number[] = [];
  for (let i = 1; i < intervals.length; i++) {
    const gap = intervals[i].start - intervals[i - 1].end;
    if (gap > 10) longPauses.push(gap);
  }
  let pauseScore = 0;
  if (totalCpr === 0) {
    parts.push('0 (pause discipline, no CPR)');
    reasons.push('Pause discipline not assessed — CPR was not initiated.');
  } else {
    const pausePenalty = Math.min(4, longPauses.length * 2);
    pauseScore = Math.max(0, 4 - pausePenalty);
    parts.push(`${pauseScore} (pause discipline, ${longPauses.length} long pauses)`);
    if (longPauses.length > 0) {
      reasons.push(`${longPauses.length} long pauses >10s detected.`);
    } else {
      reasons.push('No long compression pauses (>10s) detected.');
    }
  }

  const switchEvents = effectiveCompletions(events).filter(e => e.payload.type === 'compressor_switch');
  let switchScore = 0;
  const expectedSwitches = Math.max(0, Math.floor(totalCpr / 120));
  if (totalCpr === 0) {
    parts.push('0 (compressor swaps, no CPR)');
    reasons.push('Compressor swaps not assessed — CPR was not initiated.');
  } else if (expectedSwitches === 0) {
    switchScore = 4;
    parts.push(`${switchScore} (${switchEvents.length}/${expectedSwitches} swaps)`);
    reasons.push(`Compressor switches: ${switchEvents.length} of ${expectedSwitches} expected (every 2 min).`);
  } else {
    const ratio = Math.min(1, switchEvents.length / expectedSwitches);
    switchScore = Math.round(ratio * 4);
    parts.push(`${switchScore} (${switchEvents.length}/${expectedSwitches} swaps)`);
    reasons.push(`Compressor switches: ${switchEvents.length} of ${expectedSwitches} expected (every 2 min).`);
  }

  const awarded = Math.min(max, fracScore + pauseScore + switchScore);
  return {
    id: 'cpr_continuity',
    label: 'CPR Continuity',
    max,
    awarded,
    arithmetic: parts.join(' + ') + ` = ${awarded}/${max}`,
    reasons,
  };
}

function bucketDefibMed({ events }: BucketContext): ScoreBucket {
  const max = 15;
  const reasons: string[] = [];
  const parts: string[] = [];

  const shocks = effectiveCompletions(events).filter(e => e.payload.type === 'shock');
  let shockJoulesScore = 0;
  const joulesOk = shocks.every(e => num(e.payload.joules) === 200);
  if (shocks.length > 0 && joulesOk) {
    shockJoulesScore = 5;
    reasons.push(`All ${shocks.length} shocks delivered at 200J as expected.`);
  } else if (shocks.length > 0) {
    shockJoulesScore = 2;
    reasons.push(`Some shocks delivered at non-protocol energy.`);
  } else {
    reasons.push('No shocks delivered.');
  }
  parts.push(`${shockJoulesScore} (shock energy)`);

  const epiCompletions = effectiveCompletions(events).filter(
    e => e.payload.type === 'medication' && e.payload.medication === 'epinephrine',
  );
  let epiScore = 0;
  if (epiCompletions.length === 0) {
    reasons.push('No epinephrine doses given.');
  } else {
    const intervals: number[] = [];
    let prev: number | null = null;
    for (const e of epiCompletions) {
      if (prev !== null) intervals.push(e.timestamp - prev);
      prev = e.timestamp;
    }
    const inWindow = intervals.filter(i => i >= 180 && i <= 300).length;
    if (intervals.length === 0) {
      epiScore = 3;
      reasons.push(`Epi given once at ${epiCompletions[0].timestamp.toFixed(0)}s.`);
    } else {
      epiScore = Math.min(5, 2 + inWindow);
      reasons.push(`Epi intervals: ${intervals.map(i => `${i.toFixed(0)}s`).join(', ')}; ${inWindow} within 3–5min window.`);
    }
  }
  parts.push(`${epiScore} (epi cadence)`);

  const amio = effectiveCompletions(events).filter(
    e => e.payload.type === 'medication' && e.payload.medication === 'amiodarone',
  );
  let amioScore = 0;
  if (amio.length === 0) {
    reasons.push('No amiodarone given (consider after 2nd shock).');
  } else if (amio.length >= 1 && amio[0].payload.doseMg === 300) {
    amioScore += 3;
    reasons.push('First amiodarone dose 300mg.');
  } else if (amio.length >= 1) {
    amioScore += 1;
    reasons.push('First amiodarone dose at non-protocol amount.');
  }
  if (amio.length >= 2 && amio[1].payload.doseMg === 150) {
    amioScore += 2;
    reasons.push('Second amiodarone dose 150mg.');
  }
  amioScore = Math.min(5, amioScore);
  parts.push(`${amioScore} (amiodarone)`);

  const awarded = Math.min(max, shockJoulesScore + epiScore + amioScore);
  return {
    id: 'defib_med',
    label: 'Defibrillation & Medication Protocol',
    max,
    awarded,
    arithmetic: parts.join(' + ') + ` = ${awarded}/${max}`,
    reasons,
  };
}

function bucketDelegationClc({ events }: BucketContext): ScoreBucket {
  const max = 25;
  const reasons: string[] = [];
  const parts: string[] = [];

  const issued = findAll(events, 'pendingOrder.issued');
  const wrongRecipient = findAll(events, 'pendingOrder.wrong_recipient').length;
  const delayed = findAll(events, 'pendingOrder.delayed');
  const missed = findAll(events, 'pendingOrder.missed');
  const failed = findAll(events, 'pendingOrder.failed');
  const completed = findAll(events, 'pendingOrder.completed');
  const successful = completed.length + delayed.length;

  let assignmentScore = 0;
  if (issued.length === 0) {
    parts.push('0 (assignment, no orders issued)');
    reasons.push('No orders were issued during the code.');
  } else {
    assignmentScore = 8 - Math.min(8, wrongRecipient * 2);
    parts.push(`${assignmentScore} (assignment, ${wrongRecipient} wrong-recipient)`);
    reasons.push(`${wrongRecipient} orders went to the wrong recipient.`);
  }

  const delivery = issued.length === 0 ? 0 : successful / issued.length;
  const deliveryScore = Math.round(delivery * 9);
  parts.push(`${deliveryScore} (delivery rate, ${successful}/${issued.length})`);
  reasons.push(
    `${missed.length} missed, ${failed.length} failed, ${wrongRecipient} wrong-recipient, ${delayed.length} delayed (of ${issued.length} issued).`,
  );

  const closedLoopReqs = findAll(events, 'user.closed_loop_request');
  const confirmed = findAll(events, 'team.role.confirmed');
  let clcScore = 0;
  clcScore += Math.min(4, confirmed.length);
  clcScore += Math.min(4, closedLoopReqs.length);
  clcScore = Math.min(8, clcScore);
  parts.push(`${clcScore} (closed-loop, ${confirmed.length} confirms + ${closedLoopReqs.length} CLC asks)`);
  reasons.push(`${confirmed.length} role confirmations and ${closedLoopReqs.length} closed-loop requests recorded.`);

  const awarded = Math.min(max, Math.max(0, assignmentScore) + Math.max(0, deliveryScore) + clcScore);
  return {
    id: 'delegation_clc',
    label: 'Delegation & Closed-Loop',
    max,
    awarded,
    arithmetic: parts.join(' + ') + ` = ${awarded}/${max}`,
    reasons,
  };
}

function bucketLeadershipChaos({ events, scenario }: BucketContext): ScoreBucket {
  const max = 25;
  const reasons: string[] = [];
  const parts: string[] = [];

  // Rhythm-check cadence: target every ~2 min during active CPR.
  // Available in §12 UI (Rhythm Check button); replaces the prior
  // "cycle announcements" signal which is out-of-scope for the MVP UI.
  const rhythmChecks = findAll(events, 'user.rhythm_check');
  const cprStart = events.find(e => e.eventType === 'user.start_cpr')?.timestamp;
  const lastClock = events.length > 0 ? events[events.length - 1].timestamp : 0;
  let cadenceScore = 0;
  if (cprStart !== undefined) {
    const expected = Math.max(1, Math.floor((lastClock - cprStart) / 120));
    const ratio = Math.min(1, rhythmChecks.length / expected);
    cadenceScore = Math.round(ratio * 5);
  }
  parts.push(`${cadenceScore} (rhythm-check cadence — ${rhythmChecks.length} checks)`);
  reasons.push(`${rhythmChecks.length} rhythm checks performed during the code.`);

  const chaosFired = findAll(events, 'scenario.chaos.fired');
  let chaosResponseScore = 0;
  for (const evt of chaosFired) {
    const after = events.filter(e => e.timestamp >= evt.timestamp && e.timestamp <= evt.timestamp + 30);
    if (evt.payload.chaosType === 'compressor_fatigue') {
      const responded = after.some(
        e => e.eventType === 'pendingOrder.issued' && e.payload.type === 'compressor_switch',
      );
      if (responded) {
        chaosResponseScore += 5;
        reasons.push('Compressor fatigue: switch ordered within 30s.');
      } else {
        reasons.push('Compressor fatigue: no switch within 30s.');
      }
    }
    if (evt.payload.chaosType === 'medication_delay') {
      const responded = after.some(
        e =>
          (e.eventType === 'pendingOrder.issued' && e.payload.type === 'closed_loop_request') ||
          e.eventType === 'user.closed_loop_request',
      );
      if (responded) {
        chaosResponseScore += 5;
        reasons.push('Medication delay: closed-loop confirmation requested.');
      } else {
        reasons.push('Medication delay: no closed-loop confirmation requested.');
      }
    }
  }
  chaosResponseScore = Math.min(10, chaosResponseScore);
  parts.push(`${chaosResponseScore} (chaos response)`);

  const decisionEvents = findAll(events, 'user.declare_rosc')
    .concat(findAll(events, 'user.call_time_of_death'));
  let decisionScore = 0;
  if (scenario.outcome === 'rosc') {
    decisionScore = decisionEvents.length > 0 ? 10 : 7;
    reasons.push(`Outcome: ROSC achieved.`);
  } else if (scenario.outcome === 'time_of_death') {
    decisionScore = 5;
    reasons.push(`Outcome: time of death called.`);
  } else if (scenario.outcome === 'budget_exceeded') {
    decisionScore = 2;
    reasons.push('Code timed out without resolution.');
  } else {
    decisionScore = 0;
  }
  parts.push(`${decisionScore} (decision/outcome)`);

  const awarded = Math.min(max, cadenceScore + chaosResponseScore + decisionScore);
  return {
    id: 'leadership_chaos',
    label: 'Leadership Under Chaos',
    max,
    awarded,
    arithmetic: parts.join(' + ') + ` = ${awarded}/${max}`,
    reasons,
  };
}

function buildNarrative(buckets: ScoreBucket[]): {
  strengths: string[];
  misses: string[];
  teachingPoints: string[];
} {
  const strengths: string[] = [];
  const misses: string[] = [];
  const teachingPoints: string[] = [];
  for (const b of buckets) {
    const ratio = b.max > 0 ? b.awarded / b.max : 0;
    if (ratio >= 0.8) {
      strengths.push(`${b.label}: ${b.awarded}/${b.max} — strong execution.`);
    } else if (ratio <= 0.4) {
      misses.push(`${b.label}: ${b.awarded}/${b.max} — significant gap.`);
    }
  }
  for (const b of buckets) {
    switch (b.id) {
      case 'acls_timing':
        if (b.awarded < b.max) {
          teachingPoints.push(
            'ACLS Timing — push for CPR ≤30s, first shock for VF ≤2 min, and rhythm checks every 2 min.',
          );
        }
        break;
      case 'cpr_continuity':
        if (b.awarded < b.max) {
          teachingPoints.push(
            'CPR Continuity — target compression fraction ≥80%, swap compressors every 2 min, keep pauses <10s.',
          );
        }
        break;
      case 'defib_med':
        if (b.awarded < b.max) {
          teachingPoints.push(
            'Defib & Meds — biphasic at 200J, epi every 3–5 min, amiodarone 300mg → 150mg after the 2nd shock.',
          );
        }
        break;
      case 'delegation_clc':
        if (b.awarded < b.max) {
          teachingPoints.push(
            'Delegation & CLC — assign roles aloud, confirm receipt, and ask for closed-loop readbacks for medications and shocks.',
          );
        }
        break;
      case 'leadership_chaos':
        if (b.awarded < b.max) {
          teachingPoints.push(
            'Leadership — announce cycle status every 2 min and respond to chaos events (compressor fatigue, medication delays) within 30s.',
          );
        }
        break;
    }
  }
  return { strengths, misses, teachingPoints };
}

export function computeSchemeE(replay: ReplayState, scenario: ScenarioState, endClock: number): ScoreReport {
  const ctx: BucketContext = { events: replay.events, scenario, endClock };
  const aclsTiming = bucketAclsTiming(ctx);
  const cprContinuity = bucketCprContinuity(ctx);
  const defibMed = bucketDefibMed(ctx);
  const delegationClc = bucketDelegationClc(ctx);
  const leadershipChaos = bucketLeadershipChaos(ctx);
  const buckets: ScoreBucket[] = [aclsTiming, cprContinuity, defibMed, delegationClc, leadershipChaos];
  const total = buckets.reduce((s, b) => s + b.awarded, 0);
  const narrative = buildNarrative(buckets);
  return {
    total,
    generatedAt: endClock,
    aclsTiming,
    cprContinuity,
    defibMed,
    delegationClc,
    leadershipChaos,
    buckets,
    arithmetic: {
      acls_timing: aclsTiming.arithmetic,
      cpr_continuity: cprContinuity.arithmetic,
      defib_med: defibMed.arithmetic,
      delegation_clc: delegationClc.arithmetic,
      leadership_chaos: leadershipChaos.arithmetic,
    },
    strengths: narrative.strengths,
    misses: narrative.misses,
    teachingPoints: narrative.teachingPoints,
  };
}
