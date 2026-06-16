import type { SimulationState } from './types/state';
import type { UserAction } from './types/actions';
import type { ScenarioInput } from './types/scenario';
import type { OrderType, MedicationType, TeamRole } from './types/core';

import { fnv1a, type RngState } from './rng';
import { append, createReplayState } from './replay/replayEngine';
import { initScenarioState, stepScenario, endScenario } from './scenario/scenarioEngine';
import { initRhythmState, stepRhythm, applyShock } from './rhythm/rhythmEngine';
import { initPhysiology, stepPhysiology } from './physiology/physiologyEngine';
import {
  initTeamState,
  stepTeam,
  assignRole,
  confirmRole,
  applyFatigue,
  clearFatigue,
  applyOrderAcknowledgment,
} from './team/teamEngine';
import { initOrdersState, issueOrder, stepOrders } from './orders/pendingOrdersEngine';
import { computeSchemeE } from './scoring/schemeE';
import { buildWitnessedVfArrest } from './scenario/witnessedVfArrest';
import { isShockable, isPerfusing } from './clinical/aclsConstants';
import type { ClinicalState } from './types/clinical';
import type { PendingOrder } from './types/orders';
import { recordInvestigation, type InvestigationId } from './clinical/reversiblesEngine';

const STEP_SECONDS = 0.1;

function initClinical(): ClinicalState {
  const reversibles: Record<string, ClinicalState['reversibles'][string]> = {};
  const causeIds: string[] = ['hypovolemia','hypoxia','acidosis','hyperkalemia','hypokalemia','hypothermia','tension_pneumothorax','tamponade','toxins','thrombosis_pe','thrombosis_mi'];
  for (const id of causeIds) {
    reversibles[id] = {
      causeId: id,
      status: 'red',
      investigationsDone: [],
      interventionsDone: [],
      declared: false,
      declaredAt: null,
      ruledOut: false,
      treated: false,
    };
  }
  return {
    cprActive: false,
    cprIntervals: [],
    defibCharged: false,
    defibChargedAt: null,
    shockCount: 0,
    lastShockAt: null,
    hasIVAccess: false,
    hasIOAccess: false,
    hasAdvancedAirway: false,
    ivPlacedAt: null,
    airwayPlacedAt: null,
    lastRhythmCheckAt: null,
    lastPulseCheckAt: null,
    lastEpiAt: null,
    amiodaroneDoses: 0,
    medications: [],
    cyclesAnnounced: 0,
    closedLoopRequests: 0,
    closedLoopSatisfied: 0,
    lastCompressorSwitchAt: null,
    currentCompressorId: null,
    pendingChaosMedDelayUntil: null,
    reversibles,
    hasUltrasound: true,
    workingDiagnosis: null,
    workingDiagnosisDeclaredAt: null,
    investigationCount: 0,
    inappropriateInvestigations: 0,
  };
}

export function initSimulationState(input: ScenarioInput): SimulationState {
  const seed = fnv1a(input.seed);
  const scenario = initScenarioState(input);
  const rhythm = initRhythmState(input.initialRhythm, 0);
  const physiology = initPhysiology(rhythm);
  const team = initTeamState(input);
  const orders = initOrdersState();
  const clinical = initClinical();

  let replay = createReplayState();
  replay = append(replay, 0, 'scenario', 'scenario.started', {
    scenarioId: input.scenarioId,
    seed: input.seed,
    initialRhythm: input.initialRhythm,
    realTimeBudget: input.realTimeBudget,
  });

  const compressor = team.members.find(m => m.assignedRole === 'compressor') ?? null;
  const clinicalWithCompressor: ClinicalState = {
    ...clinical,
    currentCompressorId: compressor ? compressor.id : null,
  };

  return {
    scenario,
    rhythm,
    physiology,
    team,
    orders,
    clinical: clinicalWithCompressor,
    replay,
    score: null,
    clock: 0,
    rng: seed,
    phase: 'briefing',
  };
}

export function startSimulation(state: SimulationState): SimulationState {
  if (state.phase !== 'briefing') return state;
  const replay = append(state.replay, state.clock, 'scenario', 'scenario.live', {});
  return { ...state, phase: 'active', replay };
}

function chaosMedicationDelaySecondsFor(state: SimulationState): number {
  for (const c of state.scenario.scheduledChaos) {
    if (c.type === 'medication_delay' && c.fired === false && c.triggerKind === 'on_first_medication') {
      return c.payload?.delaySeconds ?? 0;
    }
  }
  return 0;
}

function preferredRoleForType(type: OrderType): TeamRole {
  switch (type) {
    case 'cpr_start':
    case 'cpr_pause':
    case 'compressor_switch':
      return 'compressor';
    case 'rhythm_check':
    case 'pulse_check':
    case 'charge_defib':
    case 'shock':
      return 'monitor_defib';
    case 'iv_access':
    case 'io_access':
      return 'iv_access';
    case 'airway_bvm':
    case 'airway_advanced':
      return 'airway';
    case 'medication':
      return 'medication';
    case 'announce_cycle':
      return 'recorder';
    case 'closed_loop_request':
      return 'none';
    /* Investigations */
    case 'blood_draw':
    case 'poc_glucose':
    case 'vbg_istat':
    case 'bmp':
    case 'core_temp':
      return 'iv_access';
    case 'ecg_12lead':
    case 'pocus':
    case 'chest_xray':
      return 'monitor_defib';
    case 'capnography':
      return 'airway';
    case 'medication_review':
    case 'tox_screen':
      return 'medication';
    default:
      return 'none';
  }
}

function applyUserAction(state: SimulationState, action: UserAction): SimulationState {
  if (state.phase !== 'active') return state;
  const clock = state.clock;
  let s = state;
  switch (action.kind) {
    case 'assign_role': {
      const r = assignRole(s.team, s.replay, action.memberId, action.role, clock);
      s = { ...s, team: r.team, replay: r.replay };
      return s;
    }
    case 'confirm_role': {
      const r = confirmRole(s.team, s.replay, action.memberId, clock);
      s = { ...s, team: r.team, replay: r.replay };
      return s;
    }
    case 'assign_compressor': {
      // §12 MVP: "Assign Compressor" is not a timed order. It activates the initial
      // compressor role only if no compressor is currently active/tracked.
      if (s.clinical.currentCompressorId) return s;

      const existing = s.team.members.find(m => m.assignedRole === 'compressor') ?? null;
      if (existing) {
        return {
          ...s,
          team: clearFatigue(s.team, existing.id),
          clinical: { ...s.clinical, currentCompressorId: existing.id },
        };
      }

      const candidates = s.team.members
        .filter(m => m.inRoom && !m.isLeader && m.assignedRole !== 'none')
        .slice()
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const picked = candidates[0] ?? null;
      if (!picked) return s;

      const r = assignRole(s.team, s.replay, picked.id, 'compressor', clock);
      return {
        ...s,
        team: clearFatigue(r.team, picked.id),
        replay: r.replay,
        clinical: { ...s.clinical, currentCompressorId: picked.id },
      };
    }
    case 'declare_rosc': {
      const valid = isPerfusing(s.rhythm.current) && s.rhythm.pulsePresent;
      const replay = append(s.replay, clock, 'user', 'user.declare_rosc', {
        valid,
        rhythm: s.rhythm.current,
        pulsePresent: s.rhythm.pulsePresent,
      });
      if (!valid) {
        const replay2 = append(replay, clock, 'system', 'system.rosc_declaration_rejected', {
          rhythm: s.rhythm.current,
          pulsePresent: s.rhythm.pulsePresent,
          reason: !isPerfusing(s.rhythm.current)
            ? 'no_perfusing_rhythm'
            : 'no_pulse',
        });
        return { ...s, replay: replay2 };
      }
      const ended = endScenario(s.scenario, replay, clock, 'rosc');
      return { ...s, scenario: ended.scenario, replay: ended.replay, phase: 'ended' };
    }
    case 'call_time_of_death': {
      const replay = append(s.replay, clock, 'user', 'user.call_time_of_death', {});
      const ended = endScenario(s.scenario, replay, clock, 'time_of_death');
      return { ...s, scenario: ended.scenario, replay: ended.replay, phase: 'ended' };
    }
    case 'request_closed_loop': {
      const replay = append(s.replay, clock, 'user', 'user.closed_loop_request', { orderId: action.orderId });
      return {
        ...s,
        replay,
        clinical: { ...s.clinical, closedLoopRequests: s.clinical.closedLoopRequests + 1 },
      };
    }
    default:
      break;
  }

  let type: OrderType;
  let label: string;
  let payload: PendingOrder['payload'] = {};
  switch (action.kind) {
    case 'order_cpr_start':
      type = 'cpr_start';
      label = 'Start CPR';
      break;
    case 'order_cpr_pause':
      type = 'cpr_pause';
      label = 'Hold compressions';
      break;
    case 'order_rhythm_check':
      type = 'rhythm_check';
      label = 'Rhythm check';
      break;
    case 'order_pulse_check':
      type = 'pulse_check';
      label = 'Pulse check';
      break;
    case 'order_charge_defib':
      type = 'charge_defib';
      label = 'Charge defibrillator (200J)';
      payload = { joules: 200 };
      break;
    case 'order_shock':
      type = 'shock';
      label = 'Deliver shock';
      payload = { joules: 200 };
      break;
    case 'order_iv_access':
      type = 'iv_access';
      label = 'Establish IV access';
      break;
    case 'order_io_access':
      type = 'io_access';
      label = 'Establish IO access';
      break;
    case 'order_airway_bvm':
      type = 'airway_bvm';
      label = 'BVM ventilation';
      break;
    case 'order_airway_advanced':
      type = 'airway_advanced';
      label = 'Place advanced airway';
      break;
    case 'order_medication':
      type = 'medication';
      label = `${action.medication} ${action.doseMg}mg`;
      payload = { medication: action.medication, doseMg: action.doseMg };
      break;
    case 'order_compressor_switch':
      type = 'compressor_switch';
      label = 'Switch compressor';
      break;
    case 'order_announce_cycle':
      type = 'announce_cycle';
      label = 'Announce cycle / 2-minute mark';
      break;
    /* Investigations */
    case 'order_blood_draw':
      type = 'blood_draw'; label = 'Blood draw / labs'; break;
    case 'order_poc_glucose':
      type = 'poc_glucose'; label = 'Point-of-care glucose'; break;
    case 'order_vbg_istat':
      type = 'vbg_istat'; label = 'VBG / iStat'; break;
    case 'order_bmp':
      type = 'bmp'; label = 'BMP (chem panel)'; break;
    case 'order_ecg_12lead':
      type = 'ecg_12lead'; label = '12-lead ECG'; break;
    case 'order_pocus':
      type = 'pocus'; label = 'POCUS (RUSH/FAST)'; break;
    case 'order_chest_xray':
      type = 'chest_xray'; label = 'Chest X-ray'; break;
    case 'order_capnography':
      type = 'capnography'; label = 'Capnography / ETCO2'; break;
    case 'order_core_temp':
      type = 'core_temp'; label = 'Core temperature'; break;
    case 'order_medication_review':
      type = 'medication_review'; label = 'Medication & history review'; break;
    case 'order_tox_screen':
      type = 'tox_screen'; label = 'Toxicology screen'; break;
    case 'declare_working_diagnosis': {
      const causeId = action.causeId;
      const rev = s.clinical.reversibles[causeId];
      if (!rev) return s;
      const nextRev = {
        ...rev,
        declared: true,
        declaredAt: clock,
      };
      const nextReversibles = {
        ...s.clinical.reversibles,
        [causeId]: nextRev,
      };
      const replay = append(s.replay, clock, 'user', 'user.declare_working_diagnosis', {
        causeId,
        previousWorking: s.clinical.workingDiagnosis,
      });
      s = {
        ...s,
        clinical: {
          ...s.clinical,
          reversibles: nextReversibles,
          workingDiagnosis: causeId,
          workingDiagnosisDeclaredAt: clock,
        },
        replay,
      };
      return s;
    }
    default:
      return s;
  }

  const chaosDelay = type === 'medication' ? chaosMedicationDelaySecondsFor(s) : 0;
  const issued = issueOrder({
    orders: s.orders,
    team: s.team,
    replay: s.replay,
    rng: s.rng,
    clock,
    type,
    label,
    preferredRole: preferredRoleForType(type),
    payload,
    chaosMedicationDelaySeconds: chaosDelay,
  });
  s = { ...s, orders: issued.orders, replay: issued.replay, rng: issued.rng };

  // If this is a medication order, mark scenario chaos pump
  if (type === 'medication') {
    const sStep = stepScenario({
      scenario: s.scenario,
      replay: s.replay,
      clock,
      medicationOrderedThisTick: true,
    });
    s = { ...s, scenario: sStep.scenario, replay: sStep.replay };
  }

  // User-issued speech
  s = {
    ...s,
    replay: append(s.replay, clock, 'user', 'user.order_issued', {
      orderId: issued.order.id,
      type,
      label,
    }),
  };
  return s;
}

function applyOrderEffects(state: SimulationState, finalized: PendingOrder[]): SimulationState {
  let s = state;
  for (const o of finalized) {
    if (o.outcome !== 'completed' && o.outcome !== 'delayed') continue;
    const t = o.schedule.terminalAt ?? s.clock;
    switch (o.type) {
      case 'cpr_start':
        if (!s.clinical.cprActive) {
          s = {
            ...s,
            clinical: {
              ...s.clinical,
              cprActive: true,
              cprIntervals: [
                ...s.clinical.cprIntervals,
                { startedAt: t, endedAt: null, compressorId: s.clinical.currentCompressorId },
              ],
            },
          };
        }
        break;
      case 'cpr_pause': {
        const intervals = [...s.clinical.cprIntervals];
        const last = intervals[intervals.length - 1];
        if (last && last.endedAt === null) intervals[intervals.length - 1] = { ...last, endedAt: t };
        s = { ...s, clinical: { ...s.clinical, cprActive: false, cprIntervals: intervals } };
        break;
      }
      case 'compressor_switch': {
        const currentId = s.clinical.currentCompressorId;
        const current = currentId ? s.team.members.find(m => m.id === currentId) ?? null : null;
        const byRole = s.team.members.find(m => m.assignedRole === 'compressor') ?? null;
        const active = current ?? byRole;
        if (!active) break;

        // Rotate to a different in-room, non-leader member when possible.
        const rotateCandidates = s.team.members
          .filter(m => m.inRoom && !m.isLeader && m.assignedRole !== 'none' && m.id !== active.id)
          .slice()
          .sort((a, b) => (a.fatigueLevel - b.fatigueLevel) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        const next = rotateCandidates[0] ?? null;

        if (!next) {
          // Fallback: treat as "activate" the existing compressor.
          s = {
            ...s,
            team: clearFatigue(s.team, active.id),
            clinical: { ...s.clinical, lastCompressorSwitchAt: t, currentCompressorId: active.id },
          };
          break;
        }

        const newTeam: typeof s.team = {
          members: s.team.members.map(m => {
            if (m.id === active.id) return { ...m, assignedRole: next.assignedRole };
            if (m.id === next.id) return { ...m, assignedRole: 'compressor' };
            return m;
          }),
        };

        s = {
          ...s,
          team: clearFatigue(newTeam, next.id),
          clinical: { ...s.clinical, lastCompressorSwitchAt: t, currentCompressorId: next.id },
        };
        break;
      }
      case 'iv_access':
        s = { ...s, clinical: { ...s.clinical, hasIVAccess: true, ivPlacedAt: t } };
        break;
      case 'io_access':
        s = { ...s, clinical: { ...s.clinical, hasIOAccess: true, ivPlacedAt: t } };
        break;
      case 'airway_bvm':
        // No persistent flag — bagging is implicit while RT is in role.
        break;
      case 'airway_advanced':
        s = { ...s, clinical: { ...s.clinical, hasAdvancedAirway: true, airwayPlacedAt: t } };
        break;
      case 'rhythm_check':
        s = { ...s, clinical: { ...s.clinical, lastRhythmCheckAt: t } };
        break;
      case 'pulse_check':
        s = { ...s, clinical: { ...s.clinical, lastPulseCheckAt: t } };
        break;
      case 'charge_defib':
        s = { ...s, clinical: { ...s.clinical, defibCharged: true, defibChargedAt: t } };
        break;
      case 'announce_cycle':
        s = { ...s, clinical: { ...s.clinical, cyclesAnnounced: s.clinical.cyclesAnnounced + 1 } };
        break;
      case 'medication': {
        const med = o.payload.medication as MedicationType | undefined;
        const dose = o.payload.doseMg ?? 0;
        if (med) {
          const meds = [...s.clinical.medications, { type: med, doseMg: dose, givenAt: t }];
          let lastEpi = s.clinical.lastEpiAt;
          let amioCount = s.clinical.amiodaroneDoses;
          if (med === 'epinephrine') lastEpi = t;
          if (med === 'amiodarone') amioCount += 1;
          s = {
            ...s,
            clinical: {
              ...s.clinical,
              medications: meds,
              lastEpiAt: lastEpi,
              amiodaroneDoses: amioCount,
            },
          };
        }
        break;
      }
      case 'shock': {
        if (!s.clinical.defibCharged) break;
        // Shock event: pause CPR briefly, then evaluate rhythm
        const replay = append(s.replay, t, 'user', 'shock.delivered', { joules: 200, shockNumber: s.clinical.shockCount + 1 });
        s = { ...s, replay };
        const hadEpi = s.clinical.lastEpiAt !== null && t - s.clinical.lastEpiAt <= 180;
        const hadAmio = s.clinical.amiodaroneDoses > 0;
        const cprQuality = computeRecentCprQuality(s, t);
        const result = applyShock({
          rhythm: s.rhythm,
          replay: s.replay,
          rng: s.rng,
          clock: t,
          shockNumberThisCode: s.clinical.shockCount + 1,
          hadEpiBeforeShock: hadEpi,
          hadAmiodaroneBeforeShock: hadAmio,
          cprQualityFactor: cprQuality,
        });
        s = {
          ...s,
          rhythm: result.rhythm,
          replay: result.replay,
          rng: result.rng,
          clinical: {
            ...s.clinical,
            shockCount: s.clinical.shockCount + 1,
            lastShockAt: t,
            defibCharged: false,
            defibChargedAt: null,
          },
        };
        if (result.achievedRosc) {
          // Auto-pause CPR on ROSC
          const intervals = [...s.clinical.cprIntervals];
          const last = intervals[intervals.length - 1];
          if (last && last.endedAt === null) intervals[intervals.length - 1] = { ...last, endedAt: t };
          s = {
            ...s,
            clinical: { ...s.clinical, cprActive: false, cprIntervals: intervals },
            replay: append(s.replay, t, 'system', 'system.rosc_detected', {}),
          };
          // §12 UI has no manual ROSC declaration button. Auto-end the scenario
          // with outcome='rosc' once a perfusing rhythm with pulse is achieved
          // via shock, so the natural play surface can reach the rosc outcome.
          const ended = endScenario(s.scenario, s.replay, t, 'rosc');
          s = { ...s, scenario: ended.scenario, replay: ended.replay, phase: 'ended' };
          return s;
        }
        break;
      }
      /* Investigations */
      case 'blood_draw':
      case 'poc_glucose':
      case 'vbg_istat':
      case 'bmp':
      case 'ecg_12lead':
      case 'pocus':
      case 'chest_xray':
      case 'capnography':
      case 'core_temp':
      case 'medication_review':
      case 'tox_screen': {
        // Record investigation in reversibles
        const isArrest = s.rhythm.current === 'asystole' || s.rhythm.current === 'pea' || s.rhythm.current === 'vfib' || s.rhythm.current === 'vtach';
        const newReversibles = recordInvestigation(
          s.clinical.reversibles,
          o.type as InvestigationId,
          s.clinical.hasUltrasound,
          isArrest,
        );
        s = {
          ...s,
          clinical: {
            ...s.clinical,
            reversibles: newReversibles,
            investigationCount: s.clinical.investigationCount + 1,
          },
        };
        break;
      }
    }
  }
  return s;
}

function computeRecentCprQuality(state: SimulationState, atClock: number): number {
  const window = 60;
  const start = Math.max(0, atClock - window);
  let activeSec = 0;
  for (const iv of state.clinical.cprIntervals) {
    const s = Math.max(start, iv.startedAt);
    const e = Math.min(atClock, iv.endedAt ?? atClock);
    if (e > s) activeSec += e - s;
  }
  const fraction = activeSec / window;
  return Math.max(0, Math.min(1, fraction));
}

export function tickOnce(state: SimulationState): SimulationState {
  if (state.phase !== 'active') return state;
  let s = state;
  const dt = STEP_SECONDS;
  s = { ...s, clock: s.clock + dt };

  // Step orders → may finalize, which produces side effects
  const ordersStep = stepOrders(s.orders, s.replay, s.clock);
  s = { ...s, orders: ordersStep.orders, replay: ordersStep.replay };
  if (ordersStep.finalized.length > 0) {
    s = applyOrderEffects(s, ordersStep.finalized);
  }

  // Apply acknowledgment speech for orders that just became heard
  if (ordersStep.newlyHeard.length > 0) {
    for (const o of ordersStep.newlyHeard) {
      if (!o.targetMemberId) continue;
      const ack = applyOrderAcknowledgment({
        team: s.team,
        rng: s.rng,
        memberId: o.targetMemberId,
        clock: s.clock,
      });
      s = { ...s, team: ack.team, rng: ack.rng };
    }
  }

  // Step rhythm
  const rhythmStep = stepRhythm({
    rhythm: s.rhythm,
    replay: s.replay,
    rng: s.rng,
    clock: s.clock,
    cprActive: s.clinical.cprActive,
    hasAdvancedAirway: s.clinical.hasAdvancedAirway,
    secondsSinceLastEpi: s.clinical.lastEpiAt === null ? null : s.clock - s.clinical.lastEpiAt,
    shockCount: s.clinical.shockCount,
  });
  s = { ...s, rhythm: rhythmStep.rhythm, replay: rhythmStep.replay, rng: rhythmStep.rng };

  // Step physiology
  const physStep = stepPhysiology(
    { physiology: s.physiology, rhythm: s.rhythm, clinical: s.clinical, replay: s.replay, clock: s.clock },
    dt,
  );
  s = { ...s, physiology: physStep.physiology, replay: physStep.replay };

  // Step team
  const teamStep = stepTeam(s.team, s.replay, s.rng, s.clock, s.clinical.cprActive, s.clinical.currentCompressorId);
  s = { ...s, team: teamStep.team, replay: teamStep.replay, rng: teamStep.rng };

  // Step scenario chaos (time-based)
  const scenStep = stepScenario({
    scenario: s.scenario,
    replay: s.replay,
    clock: s.clock,
    medicationOrderedThisTick: false,
  });
  s = { ...s, scenario: scenStep.scenario, replay: scenStep.replay };

  if (scenStep.firedChaos.length > 0) {
    for (const chaos of scenStep.firedChaos) {
      if (chaos.type === 'compressor_fatigue' && s.clinical.currentCompressorId) {
        s = {
          ...s,
          team: applyFatigue(s.team, s.clinical.currentCompressorId, 60),
          replay: append(s.replay, s.clock, 'team', 'team.compressor.fatigued', {
            memberId: s.clinical.currentCompressorId,
          }),
        };
      }
    }
  }

  // Budget check
  if (s.clock >= s.scenario.realTimeBudget.maxSeconds && !s.scenario.ended) {
    const ended = endScenario(s.scenario, s.replay, s.clock, 'budget_exceeded');
    s = { ...s, scenario: ended.scenario, replay: ended.replay, phase: 'ended' };
  }

  return s;
}

export function dispatchUserAction(state: SimulationState, action: UserAction): SimulationState {
  return applyUserAction(state, action);
}

export function finalizeAndScore(state: SimulationState): SimulationState {
  if (state.score) return state;
  let s = state;
  if (!s.scenario.ended) {
    const ended = endScenario(s.scenario, s.replay, s.clock, s.scenario.outcome ?? 'budget_exceeded');
    s = { ...s, scenario: ended.scenario, replay: ended.replay };
  }
  const score = computeSchemeE(s.replay, s.scenario, s.scenario.endedAt ?? s.clock);
  return { ...s, score, phase: 'debrief' };
}

export interface ScheduledAction {
  at: number;
  action: UserAction;
}

export interface ReplayOptions {
  scenarioInput?: ScenarioInput;
  maxSeconds?: number;
}

export function replay(
  seed: string,
  userActions: ScheduledAction[],
  options: ReplayOptions = {},
): import('./types/replay').ReplayEvent[] {
  const input: ScenarioInput =
    options.scenarioInput ?? buildWitnessedVfArrest(seed);
  let s = initSimulationState(input);
  s = startSimulation(s);
  const sorted = [...userActions].sort((a, b) => a.at - b.at);
  const maxSeconds = options.maxSeconds ?? input.realTimeBudget.maxSeconds;
  let i = 0;
  while (s.phase !== 'ended' && s.phase !== 'debrief' && s.clock < maxSeconds) {
    while (i < sorted.length && sorted[i].at <= s.clock) {
      s = dispatchUserAction(s, sorted[i].action);
      i += 1;
    }
    s = tickOnce(s);
  }
  while (i < sorted.length) {
    s = dispatchUserAction(s, sorted[i].action);
    i += 1;
  }
  return s.replay.events;
}

export type { SimulationState } from './types/state';
export type { UserAction } from './types/actions';
export type { ReplayEvent } from './types/replay';
export { formatEvent, formatEvents, formatEventsAsText, formatClock } from './replay/replayFormatter';
