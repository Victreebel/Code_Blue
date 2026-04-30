import type {
  OrderType,
  OrderStatus,
  OrderOutcome,
  OrderFailureSubtype,
  MedicationType,
} from './core';

export interface OrderSchedule {
  heardAt: number | null;
  acknowledgedAt: number | null;
  inProgressAt: number | null;
  terminalAt: number | null;
}

export interface PendingOrder {
  id: string;
  type: OrderType;
  label: string;
  issuedAt: number;
  targetMemberId: string | null;
  targetRole: string | null;
  status: OrderStatus;
  outcome: OrderOutcome | null;
  failureSubtype: OrderFailureSubtype | null;
  schedule: OrderSchedule;
  payload: {
    medication?: MedicationType;
    doseMg?: number;
    joules?: number;
    note?: string;
  };
}

export interface OrdersState {
  orders: PendingOrder[];
  nextSeq: number;
}
