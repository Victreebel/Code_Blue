import type { TeamRole, MedicationType } from './core';

export type UserAction =
  | { kind: 'assign_role'; memberId: string; role: TeamRole }
  | { kind: 'confirm_role'; memberId: string }
  | { kind: 'order_cpr_start' }
  | { kind: 'order_cpr_pause' }
  | { kind: 'order_rhythm_check' }
  | { kind: 'order_pulse_check' }
  | { kind: 'order_charge_defib' }
  | { kind: 'order_shock' }
  | { kind: 'order_iv_access' }
  | { kind: 'order_io_access' }
  | { kind: 'order_airway_bvm' }
  | { kind: 'order_airway_advanced' }
  | { kind: 'order_medication'; medication: MedicationType; doseMg: number }
  | { kind: 'order_compressor_switch'; toMemberId?: string }
  | { kind: 'order_announce_cycle' }
  | { kind: 'request_closed_loop'; orderId: string }
  | { kind: 'call_time_of_death' }
  | { kind: 'declare_rosc' };
