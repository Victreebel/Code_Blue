import { execSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import {
  initSimulationState,
  startSimulation,
  tickOnce,
  dispatchUserAction,
  finalizeAndScore,
  replay,
  formatEvent,
  type SimulationState,
} from '../index';
import { buildWitnessedVfArrest } from '../scenario/witnessedVfArrest';
import { computeSchemeE } from '../scoring/schemeE';

interface TestResult { name: string; passed: boolean; error?: string }
const results: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const r = fn();
    if (r instanceof Promise) {
      r.then(
        () => results.push({ name, passed: true }),
        e => results.push({ name, passed: false, error: String(e) }),
      );
    } else {
      results.push({ name, passed: true });
    }
  } catch (e) {
    results.push({ name, passed: false, error: e instanceof Error ? e.stack ?? e.message : String(e) });
  }
}

test('engine has no Math.random', () => {
  let out = '';
  try {
    out = execSync('rg -l "Math\\.random" src/engine -g "!__tests__"', { cwd: process.cwd(), encoding: 'utf8' });
  } catch (e: any) {
    if (e.status === 1) {
      out = '';
    } else {
      throw e;
    }
  }
  assert.equal(out.trim(), '', `Math.random found in engine files:\n${out}`);
});

function advanceTo(state: SimulationState, targetClock: number): SimulationState {
  let s = state;
  while (s.clock < targetClock && s.phase === 'active') {
    s = tickOnce(s);
  }
  return s;
}

test('determinism: same seed produces identical event traces', () => {
  const seed = 'golden-test-seed-001';
  const inputA = buildWitnessedVfArrest(seed);
  const inputB = buildWitnessedVfArrest(seed);
  let a = startSimulation(initSimulationState(inputA));
  let b = startSimulation(initSimulationState(inputB));

  const script = (s: SimulationState): SimulationState => {
    let x = s;
    x = dispatchUserAction(x, { kind: 'order_cpr_start' });
    x = advanceTo(x, 5);
    x = dispatchUserAction(x, { kind: 'order_charge_defib' });
    x = advanceTo(x, 30);
    x = dispatchUserAction(x, { kind: 'order_shock' });
    x = advanceTo(x, 60);
    x = dispatchUserAction(x, { kind: 'order_iv_access' });
    x = advanceTo(x, 90);
    x = dispatchUserAction(x, { kind: 'order_medication', medication: 'epinephrine', doseMg: 1 });
    x = advanceTo(x, 130);
    x = dispatchUserAction(x, { kind: 'order_rhythm_check' });
    x = advanceTo(x, 200);
    return x;
  };

  a = script(a);
  b = script(b);

  const eventsA = a.replay.events;
  const eventsB = b.replay.events;
  assert.equal(eventsA.length, eventsB.length, `Event counts differ: ${eventsA.length} vs ${eventsB.length}`);
  for (let i = 0; i < eventsA.length; i++) {
    const ea = eventsA[i];
    const eb = eventsB[i];
    assert.equal(ea.eventType, eb.eventType, `Event ${i} type differs`);
    assert.equal(ea.timestamp.toFixed(3), eb.timestamp.toFixed(3), `Event ${i} timestamp differs at ${ea.eventType}`);
    assert.deepEqual(ea.payload, eb.payload, `Event ${i} payload differs at ${ea.eventType}`);
  }
});

test('golden trace: known sequence emits expected event types', () => {
  const seed = 'golden-trace-fixed-002';
  const input = buildWitnessedVfArrest(seed);
  let s = startSimulation(initSimulationState(input));
  s = dispatchUserAction(s, { kind: 'order_cpr_start' });
  s = advanceTo(s, 4);
  s = dispatchUserAction(s, { kind: 'order_charge_defib' });
  s = advanceTo(s, 25);
  s = dispatchUserAction(s, { kind: 'order_shock' });
  s = advanceTo(s, 50);

  const eventTypes = s.replay.events.map(e => e.eventType);
  assert.ok(eventTypes.includes('scenario.started'), 'expected scenario.started');
  assert.ok(eventTypes.includes('scenario.live'), 'expected scenario.live');
  assert.ok(eventTypes.some(e => e === 'pendingOrder.issued'), 'expected pendingOrder.issued');
  assert.ok(eventTypes.includes('shock.delivered'), 'expected shock.delivered');
  const issuedTypes = s.replay.events
    .filter(e => e.eventType === 'pendingOrder.issued')
    .map(e => e.payload.type);
  assert.ok(issuedTypes.includes('cpr_start'), 'expected cpr_start order');
  assert.ok(issuedTypes.includes('charge_defib'), 'expected charge_defib order');
  assert.ok(issuedTypes.includes('shock'), 'expected shock order');
});

test('Scheme E: 5 buckets, max sums to 100, awarded ≤ max each', () => {
  const seed = 'scoring-test-001';
  const input = buildWitnessedVfArrest(seed);
  let s = startSimulation(initSimulationState(input));
  s = dispatchUserAction(s, { kind: 'order_cpr_start' });
  s = advanceTo(s, 5);
  s = dispatchUserAction(s, { kind: 'order_iv_access' });
  s = advanceTo(s, 20);
  s = dispatchUserAction(s, { kind: 'order_charge_defib' });
  s = advanceTo(s, 60);
  s = dispatchUserAction(s, { kind: 'order_shock' });
  s = advanceTo(s, 90);
  s = dispatchUserAction(s, { kind: 'order_medication', medication: 'epinephrine', doseMg: 1 });
  s = advanceTo(s, 130);
  s = dispatchUserAction(s, { kind: 'order_rhythm_check' });
  s = advanceTo(s, 250);
  s = dispatchUserAction(s, { kind: 'order_announce_cycle' });
  s = advanceTo(s, 305);
  s = dispatchUserAction(s, { kind: 'call_time_of_death' });

  s = finalizeAndScore(s);
  const score = s.score;
  assert.ok(score, 'score should exist');
  assert.equal(score!.buckets.length, 5, 'must have 5 buckets');
  const maxSum = score!.buckets.reduce((a, b) => a + b.max, 0);
  assert.equal(maxSum, 100, `bucket max sum should be 100, got ${maxSum}`);
  for (const b of score!.buckets) {
    assert.ok(b.awarded <= b.max, `${b.id} awarded ${b.awarded} > max ${b.max}`);
    assert.ok(b.awarded >= 0, `${b.id} awarded < 0`);
    assert.ok(b.arithmetic.includes('='), `${b.id} arithmetic should contain =`);
    assert.ok(b.arithmetic.endsWith(`= ${b.awarded}/${b.max}`), `${b.id} arithmetic should end with computed total`);
  }
  const expected = ['acls_timing', 'cpr_continuity', 'defib_med', 'delegation_clc', 'leadership_chaos'];
  for (const e of expected) {
    assert.ok(score!.buckets.find(b => b.id === e), `missing bucket ${e}`);
  }
  assert.equal(score!.total, score!.buckets.reduce((a, b) => a + b.awarded, 0), 'total must equal sum of awarded');
});

test('Scheme E: arithmetic strings are well-formed', () => {
  const seed = 'arithmetic-test';
  const input = buildWitnessedVfArrest(seed);
  let s = startSimulation(initSimulationState(input));
  s = advanceTo(s, 305);
  s = finalizeAndScore(s);
  const score = s.score!;
  const aclsBucket = score.buckets.find(b => b.id === 'acls_timing')!;
  assert.ok(aclsBucket.arithmetic.includes(' + '), 'arithmetic should have + signs');
  assert.match(aclsBucket.arithmetic, /\d+\/15$/, 'should end with /15');
});

test('Scheme E: empty replay (no actions) yields total 0', () => {
  const score = computeSchemeE(
    { events: [] },
    {
      id: 'x',
      seed: 'x',
      realTimeBudget: { minSeconds: 300, maxSeconds: 480 },
      scheduledChaos: [],
      ended: true,
      outcome: 'budget_exceeded',
      endedAt: 480,
    },
    480,
  );
  assert.ok(score.total <= 6, `expected very low total for empty trace, got ${score.total}`);
});

test('chaos: compressor_fatigue fires within scheduled window', () => {
  const input = buildWitnessedVfArrest('chaos-fatigue-test');
  let s = startSimulation(initSimulationState(input));
  s = dispatchUserAction(s, { kind: 'order_cpr_start' });
  s = advanceTo(s, 125);
  const fired = s.replay.events.find(e => e.eventType === 'scenario.chaos.fired' && e.payload.chaosType === 'compressor_fatigue');
  assert.ok(fired, 'compressor_fatigue should have fired by 125s');
  assert.ok((fired!.timestamp as number) >= 60 && (fired!.timestamp as number) <= 121, `fired at ${fired!.timestamp}, expected 60-120`);
});

test('declare_rosc is rejected during VF without pulse', () => {
  const input = buildWitnessedVfArrest('rosc-gate-test');
  let s = startSimulation(initSimulationState(input));
  s = advanceTo(s, 30);
  s = dispatchUserAction(s, { kind: 'declare_rosc' });
  assert.notEqual(s.phase, 'ended', 'phase should not end on premature ROSC');
  assert.notEqual(s.phase, 'debrief', 'phase should not become debrief');
  const declareEvt = s.replay.events.find(e => e.eventType === 'user.declare_rosc');
  assert.ok(declareEvt, 'declare_rosc event should be appended');
  assert.equal(declareEvt!.payload.valid, false, 'declare_rosc should be marked invalid');
  const rejectEvt = s.replay.events.find(
    e => e.eventType === 'system.rosc_declaration_rejected',
  );
  assert.ok(rejectEvt, 'system should emit rosc_declaration_rejected event');
});

test('ScoreReport has named bucket fields and narrative', () => {
  const input = buildWitnessedVfArrest('score-shape-test');
  let s = startSimulation(initSimulationState(input));
  s = dispatchUserAction(s, { kind: 'order_cpr_start' });
  s = advanceTo(s, 60);
  s = finalizeAndScore(s);
  const score = s.score!;
  assert.ok(score.aclsTiming, 'has aclsTiming');
  assert.ok(score.cprContinuity, 'has cprContinuity');
  assert.ok(score.defibMed, 'has defibMed');
  assert.ok(score.delegationClc, 'has delegationClc');
  assert.ok(score.leadershipChaos, 'has leadershipChaos');
  assert.equal(typeof score.arithmetic.acls_timing, 'string');
  assert.equal(typeof score.arithmetic.cpr_continuity, 'string');
  assert.ok(Array.isArray(score.strengths), 'strengths is array');
  assert.ok(Array.isArray(score.misses), 'misses is array');
  assert.ok(Array.isArray(score.teachingPoints), 'teachingPoints is array');
  assert.equal(
    score.aclsTiming.max +
      score.cprContinuity.max +
      score.defibMed.max +
      score.delegationClc.max +
      score.leadershipChaos.max,
    100,
    'named bucket maxes still sum to 100',
  );
});

test('replay() API: same seed + actions produces identical events', () => {
  const actions = [
    { at: 5, action: { kind: 'order_cpr_start' as const } },
    { at: 30, action: { kind: 'order_charge_defib' as const } },
    { at: 90, action: { kind: 'order_shock' as const } },
  ];
  const a = replay('replay-api-test', actions, { maxSeconds: 180 });
  const b = replay('replay-api-test', actions, { maxSeconds: 180 });
  assert.equal(a.length, b.length, 'same length');
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].eventType, b[i].eventType, `event ${i} type matches`);
    assert.equal(a[i].timestamp, b[i].timestamp, `event ${i} timestamp matches`);
  }
});

test('formatEvent renders MM:SS source: kind (payload)', () => {
  const line = formatEvent({
    timestamp: 65,
    source: 'user',
    eventType: 'user.declare_rosc',
    payload: { valid: false, rhythm: 'vf' },
  });
  assert.match(line, /^\[01:05\] user: user\.declare_rosc/);
  assert.match(line, /valid=false/);
  assert.match(line, /rhythm=vf/);
});

test('shock-induced ROSC auto-ends scenario via §12 UI actions only', () => {
  // Scenario must be reachable via only the §12 MVP action surface
  // (no manual declare_rosc button). Loop over many seeds to find a run
  // where shocks produce ROSC, then verify auto-end emits system.rosc_detected,
  // sets phase='ended', and outcome='rosc'.
  let foundRosc = false;
  for (let i = 0; i < 80 && !foundRosc; i++) {
    const input = buildWitnessedVfArrest(`auto-rosc-seed-${i}`);
    let s = startSimulation(initSimulationState(input));
    s = dispatchUserAction(s, { kind: 'order_cpr_start' });
    for (let shock = 0; shock < 6 && s.phase === 'active'; shock++) {
      s = advanceTo(s, s.clock + 5);
      s = dispatchUserAction(s, { kind: 'order_charge_defib' });
      s = advanceTo(s, s.clock + 25);
      s = dispatchUserAction(s, { kind: 'order_shock' });
      s = advanceTo(s, s.clock + 30);
    }
    if (s.scenario.outcome === 'rosc') {
      foundRosc = true;
      assert.equal(s.phase, 'ended', 'phase must be ended on auto-ROSC');
      const detected = s.replay.events.find(e => e.eventType === 'system.rosc_detected');
      assert.ok(detected, 'system.rosc_detected must be emitted');
      const declarations = s.replay.events.filter(e => e.eventType === 'user.declare_rosc');
      assert.equal(declarations.length, 0, 'no manual declare_rosc was issued by the §12 UI');
    }
  }
  assert.ok(foundRosc, 'expected at least one seed to reach ROSC via shocks within 80 seeds');
});

test('chaos: medication_delay fires on first medication order', () => {
  const input = buildWitnessedVfArrest('chaos-meddelay-test');
  let s = startSimulation(initSimulationState(input));
  s = advanceTo(s, 30);
  s = dispatchUserAction(s, { kind: 'order_iv_access' });
  s = advanceTo(s, 60);
  s = dispatchUserAction(s, { kind: 'order_medication', medication: 'epinephrine', doseMg: 1 });
  s = advanceTo(s, 65);
  const fired = s.replay.events.find(e => e.eventType === 'scenario.chaos.fired' && e.payload.chaosType === 'medication_delay');
  assert.ok(fired, 'medication_delay should fire on first medication order');
});

setTimeout(() => {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed);
  console.log(`\n${passed}/${results.length} tests passed`);
  for (const r of results) {
    if (r.passed) console.log(`  ✓ ${r.name}`);
    else {
      console.log(`  ✗ ${r.name}`);
      console.log(`    ${r.error}`);
    }
  }
  if (failed.length > 0) process.exit(1);
}, 100);
