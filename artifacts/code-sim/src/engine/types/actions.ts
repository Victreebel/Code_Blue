import type { TeamRole, MedicationType, ReversibleCauseId } from './core';

export type UserAction =
  | { kind: 'assign_role'; memberId: string; role: TeamRole }
  | { kind: 'confirm_role'; memberId: string }
  | { kind: 'assign_compressor' }
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
  | { kind: 'declare_rosc' }
  /* Investigations */
  | { kind: 'order_blood_draw' }
  | { kind: 'order_poc_glucose' }
  | { kind: 'order_vbg_istat' }
  | { kind: 'order_bmp' }
  | { kind: 'order_ecg_12lead' }
  | { kind: 'order_pocus' }
  | { kind: 'order_chest_xray' }
  | { kind: 'order_capnography' }
  | { kind: 'order_core_temp' }
  | { kind: 'order_medication_review' }
  | { kind: 'order_tox_screen' }
  | { kind: 'declare_working_diagnosis'; causeId: ReversibleCauseId };
