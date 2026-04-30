export type Rhythm = 'vfib' | 'vtach' | 'pea' | 'asystole' | 'sinus' | 'sinus_brady' | 'sinus_tachy';

export type TeamRole =
  | 'leader'
  | 'compressor'
  | 'airway'
  | 'iv_access'
  | 'medication'
  | 'monitor_defib'
  | 'recorder'
  | 'timekeeper'
  | 'none';

export type StaffType = 'nurse' | 'resident' | 'attending' | 'rt' | 'tech' | 'student' | 'pharmacist';

export type Competence = 'low' | 'medium' | 'high';
export type Compliance = 'cooperative' | 'independent' | 'resistant';

export type MedicationType = 'epinephrine' | 'amiodarone' | 'lidocaine' | 'atropine' | 'bicarb' | 'calcium' | 'magnesium';

export type OrderType =
  | 'cpr_start'
  | 'cpr_pause'
  | 'rhythm_check'
  | 'pulse_check'
  | 'charge_defib'
  | 'shock'
  | 'iv_access'
  | 'io_access'
  | 'airway_bvm'
  | 'airway_advanced'
  | 'medication'
  | 'compressor_switch'
  | 'announce_cycle'
  | 'closed_loop_request';

export type OrderStatus = 'issued' | 'heard' | 'acknowledged' | 'in_progress' | 'completed' | 'delayed' | 'wrong_recipient' | 'failed' | 'missed';

export type OrderOutcome = 'completed' | 'delayed' | 'wrong_recipient' | 'failed' | 'missed';

export type OrderFailureSubtype =
  | 'not_heard'
  | 'heard_by_wrong_person'
  | 'acknowledged_but_delayed'
  | 'duplicated'
  | 'blocked_by_missing_prerequisite'
  | 'performed_incorrectly'
  | 'abandoned';

export type ChaosEventType = 'compressor_fatigue' | 'medication_delay';

export const RHYTHM_LABELS: Record<Rhythm, string> = {
  vfib: 'Ventricular Fibrillation',
  vtach: 'Pulseless V-Tach',
  pea: 'PEA',
  asystole: 'Asystole',
  sinus: 'Normal Sinus Rhythm',
  sinus_brady: 'Sinus Bradycardia',
  sinus_tachy: 'Sinus Tachycardia',
};

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  leader: 'Code Leader',
  compressor: 'Chest Compressions',
  airway: 'Airway Management',
  iv_access: 'IV/IO Access',
  medication: 'Medication Admin',
  monitor_defib: 'Monitor/Defibrillator',
  recorder: 'Recorder',
  timekeeper: 'Timekeeper',
  none: 'Unassigned',
};

export const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  nurse: 'RN',
  resident: 'Resident',
  attending: 'Attending',
  rt: 'RT',
  tech: 'Tech',
  student: 'Student',
  pharmacist: 'PharmD',
};

export const MEDICATION_LABELS: Record<MedicationType, string> = {
  epinephrine: 'Epinephrine',
  amiodarone: 'Amiodarone',
  lidocaine: 'Lidocaine',
  atropine: 'Atropine',
  bicarb: 'Sodium Bicarbonate',
  calcium: 'Calcium Chloride',
  magnesium: 'Magnesium Sulfate',
};

export const ORDER_FAILURE_LABELS: Record<OrderFailureSubtype, string> = {
  not_heard: 'Not heard',
  heard_by_wrong_person: 'Heard by wrong person',
  acknowledged_but_delayed: 'Acknowledged but delayed',
  duplicated: 'Duplicated by another staff',
  blocked_by_missing_prerequisite: 'Blocked — missing prerequisite',
  performed_incorrectly: 'Performed incorrectly',
  abandoned: 'Abandoned mid-task',
};

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
