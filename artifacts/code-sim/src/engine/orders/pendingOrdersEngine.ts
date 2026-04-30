import type { OrdersState, PendingOrder, OrderSchedule } from '../types/orders';
import type { OrderType, OrderOutcome, OrderFailureSubtype, TeamRole } from '../types/core';
import type { TeamState, TeamMemberRuntime } from '../types/team';
import type { ReplayState } from '../types/replay';
import { append } from '../replay/replayEngine';
import { draw, drawChoice, type RngState } from '../rng';
import { findByRole } from '../team/teamEngine';

export function initOrdersState(): OrdersState {
  return { orders: [], nextSeq: 1 };
}

interface PlannedOrderExtra {
  plannedOutcome: OrderOutcome;
  plannedFailureSubtype: OrderFailureSubtype | null;
}

interface IssueOrderInput {
  orders: OrdersState;
  team: TeamState;
  replay: ReplayState;
  rng: RngState;
  clock: number;
  type: OrderType;
  label: string;
  preferredRole: TeamRole | null;
  payload: PendingOrder['payload'];
  chaosMedicationDelaySeconds: number;
}

interface IssueOrderOutput {
  orders: OrdersState;
  replay: ReplayState;
  rng: RngState;
  order: PendingOrder & PlannedOrderExtra;
}

const ROLE_FOR_TYPE: Partial<Record<OrderType, TeamRole>> = {
  cpr_start: 'compressor',
  cpr_pause: 'compressor',
  rhythm_check: 'monitor_defib',
  pulse_check: 'monitor_defib',
  charge_defib: 'monitor_defib',
  shock: 'monitor_defib',
  iv_access: 'iv_access',
  io_access: 'iv_access',
  airway_bvm: 'airway',
  airway_advanced: 'airway',
  medication: 'medication',
  compressor_switch: 'compressor',
  announce_cycle: 'recorder',
  closed_loop_request: 'none',
};

function pickRecipient(
  team: TeamState,
  rng: RngState,
  preferredRole: TeamRole | null,
): { member: TeamMemberRuntime | null; rng: RngState; wrongRecipient: boolean } {
  if (!preferredRole || preferredRole === 'none') {
    return { member: null, rng, wrongRecipient: false };
  }
  const exact = findByRole(team, preferredRole);
  if (exact) {
    return { member: exact, rng, wrongRecipient: false };
  }
  const eligible = team.members.filter(m => !m.isLeader && m.inRoom);
  if (eligible.length === 0) {
    return { member: null, rng, wrongRecipient: true };
  }
  const [picked, ns] = drawChoice(rng, eligible);
  return { member: picked, rng: ns, wrongRecipient: true };
}

function archetypeBehaviorMix(member: TeamMemberRuntime) {
  const speed = 0.4 + member.behavior.executionSpeed * 0.6;
  const distract = member.behavior.distractibility;
  const competenceBonus =
    member.competence === 'high' ? -2 : member.competence === 'medium' ? 0 : 3;
  return { speed, distract, competenceBonus };
}

function baseExecution(type: OrderType): number {
  switch (type) {
    case 'medication': return 6;
    case 'shock': return 1.5;
    case 'charge_defib': return 4;
    case 'airway_advanced': return 18;
    case 'airway_bvm': return 3;
    case 'iv_access': return 25;
    case 'io_access': return 12;
    case 'rhythm_check': return 5;
    case 'pulse_check': return 5;
    case 'cpr_start': return 1.5;
    case 'cpr_pause': return 1;
    case 'compressor_switch': return 4;
    case 'announce_cycle': return 2;
    default: return 4;
  }
}

interface ScheduleResult {
  schedule: OrderSchedule;
  outcome: OrderOutcome;
  failureSubtype: OrderFailureSubtype | null;
  rng: RngState;
}

function scheduleOrder(
  type: OrderType,
  recipient: TeamMemberRuntime | null,
  rng: RngState,
  clock: number,
  chaosMedicationDelaySeconds: number,
): ScheduleResult {
  if (!recipient) {
    return {
      schedule: { heardAt: null, acknowledgedAt: null, inProgressAt: null, terminalAt: clock + 6 },
      outcome: 'missed',
      failureSubtype: 'not_heard',
      rng,
    };
  }
  const { speed, distract, competenceBonus } = archetypeBehaviorMix(recipient);
  let nextRng = rng;

  const [hearRoll, r1] = draw(nextRng); nextRng = r1;
  const wasHeard = hearRoll > distract * 0.5;
  if (!wasHeard) {
    return {
      schedule: { heardAt: null, acknowledgedAt: null, inProgressAt: null, terminalAt: clock + 8 },
      outcome: 'missed',
      failureSubtype: 'not_heard',
      rng: nextRng,
    };
  }

  const [hearJitter, r2] = draw(nextRng); nextRng = r2;
  const heardAt = clock + 1 + hearJitter * 2;

  const [ackRoll, r3] = draw(nextRng); nextRng = r3;
  const ackDelay = 1.5 + (1 - speed) * 4 + ackRoll * 1.5;
  const acknowledgedAt = heardAt + ackDelay;

  const [progressRoll, r4] = draw(nextRng); nextRng = r4;
  const baseExec = baseExecution(type);
  const execTime = baseExec * (1 / speed) + competenceBonus + progressRoll * 2;
  const inProgressAt = acknowledgedAt + 0.5;
  let terminalAt = inProgressAt + Math.max(0.5, execTime);

  if (type === 'medication' && chaosMedicationDelaySeconds > 0) {
    terminalAt += chaosMedicationDelaySeconds;
  }

  const [failRoll, r5] = draw(nextRng); nextRng = r5;
  const failChance =
    recipient.competence === 'low' ? 0.18 :
    recipient.competence === 'medium' ? 0.08 : 0.03;
  if (failRoll < failChance) {
    return {
      schedule: { heardAt, acknowledgedAt, inProgressAt, terminalAt: Math.max(heardAt + 1, terminalAt - 1) },
      outcome: 'failed',
      failureSubtype: 'performed_incorrectly',
      rng: nextRng,
    };
  }

  const isDelayed = terminalAt - clock > baseExec * 1.6 + 8;
  return {
    schedule: { heardAt, acknowledgedAt, inProgressAt, terminalAt },
    outcome: isDelayed ? 'delayed' : 'completed',
    failureSubtype: null,
    rng: nextRng,
  };
}

export function issueOrder(input: IssueOrderInput): IssueOrderOutput {
  const id = `ord-${input.orders.nextSeq}`;
  const preferredRole = input.preferredRole ?? ROLE_FOR_TYPE[input.type] ?? null;
  const recipientPick = pickRecipient(input.team, input.rng, preferredRole);
  const sched = scheduleOrder(
    input.type,
    recipientPick.member,
    recipientPick.rng,
    input.clock,
    input.type === 'medication' ? input.chaosMedicationDelaySeconds : 0,
  );

  let plannedOutcome = sched.outcome;
  let plannedFailureSubtype = sched.failureSubtype;
  if (recipientPick.wrongRecipient && plannedOutcome === 'completed') {
    plannedOutcome = 'wrong_recipient';
    plannedFailureSubtype = 'heard_by_wrong_person';
  }

  const order: PendingOrder & PlannedOrderExtra = {
    id,
    type: input.type,
    label: input.label,
    issuedAt: input.clock,
    targetMemberId: recipientPick.member?.id ?? null,
    targetRole: preferredRole,
    status: 'issued',
    outcome: null,
    failureSubtype: null,
    schedule: sched.schedule,
    payload: input.payload,
    plannedOutcome,
    plannedFailureSubtype,
  };

  const orders: OrdersState = {
    orders: [...input.orders.orders, order],
    nextSeq: input.orders.nextSeq + 1,
  };

  const replay = append(input.replay, input.clock, 'pendingOrder', 'pendingOrder.issued', {
    orderId: id,
    type: input.type,
    label: input.label,
    targetMemberId: recipientPick.member?.id ?? null,
    targetMemberName: recipientPick.member?.name ?? null,
    targetRole: preferredRole,
    medication: input.payload.medication,
    doseMg: input.payload.doseMg,
    joules: input.payload.joules,
    plannedOutcome,
    plannedFailureSubtype,
    plannedTerminalAt: sched.schedule.terminalAt,
  });

  return { orders, replay, rng: sched.rng, order };
}

export interface PromoteResult {
  orders: OrdersState;
  replay: ReplayState;
  finalized: PendingOrder[];
}

function plannedExtras(o: PendingOrder): PlannedOrderExtra {
  const x = o as PendingOrder & Partial<PlannedOrderExtra>;
  return {
    plannedOutcome: x.plannedOutcome ?? 'completed',
    plannedFailureSubtype: x.plannedFailureSubtype ?? null,
  };
}

export function stepOrders(
  orders: OrdersState,
  replay: ReplayState,
  clock: number,
): PromoteResult {
  let nextReplay = replay;
  const finalized: PendingOrder[] = [];

  const updates = orders.orders.map(o => {
    if (isTerminal(o.status)) return o;
    let next: PendingOrder = o;
    const planned = plannedExtras(o);

    if (next.status === 'issued' && next.schedule.heardAt !== null && clock >= next.schedule.heardAt) {
      next = { ...next, status: 'heard' };
      nextReplay = append(nextReplay, clock, 'pendingOrder', 'pendingOrder.heard', { orderId: o.id });
    }
    if (
      next.status === 'heard' &&
      next.schedule.acknowledgedAt !== null &&
      clock >= next.schedule.acknowledgedAt
    ) {
      next = { ...next, status: 'acknowledged' };
      nextReplay = append(nextReplay, clock, 'pendingOrder', 'pendingOrder.acknowledged', { orderId: o.id });
    }
    if (
      next.status === 'acknowledged' &&
      next.schedule.inProgressAt !== null &&
      clock >= next.schedule.inProgressAt
    ) {
      next = { ...next, status: 'in_progress' };
      nextReplay = append(nextReplay, clock, 'pendingOrder', 'pendingOrder.in_progress', { orderId: o.id });
    }

    if (next.schedule.terminalAt !== null && clock >= next.schedule.terminalAt && !isTerminal(next.status)) {
      let outcome: OrderOutcome = planned.plannedOutcome;
      let status: PendingOrder['status'];
      if (next.status === 'issued' && next.schedule.heardAt === null) {
        outcome = 'missed';
        status = 'missed';
      } else {
        status = outcome;
      }
      const finalSubtype: OrderFailureSubtype | null = planned.plannedFailureSubtype;
      next = { ...next, status, outcome, failureSubtype: finalSubtype };
      nextReplay = append(nextReplay, clock, 'pendingOrder', `pendingOrder.${status}`, {
        orderId: o.id,
        type: o.type,
        label: o.label,
        targetMemberId: o.targetMemberId,
        targetRole: o.targetRole,
        outcome,
        failureSubtype: finalSubtype,
        medication: o.payload.medication,
        doseMg: o.payload.doseMg,
        joules: o.payload.joules,
      });
      finalized.push(next);
    }
    return next;
  });

  return { orders: { ...orders, orders: updates }, replay: nextReplay, finalized };
}

export function isTerminal(status: PendingOrder['status']): boolean {
  return (
    status === 'completed' ||
    status === 'delayed' ||
    status === 'wrong_recipient' ||
    status === 'failed' ||
    status === 'missed'
  );
}
