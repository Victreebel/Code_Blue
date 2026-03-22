export type Rhythm = 'vfib' | 'vtach' | 'pea' | 'asystole' | 'sinus' | 'sinus_brady' | 'sinus_tachy';

export type ShockableRhythm = 'vfib' | 'vtach';
export type NonShockableRhythm = 'pea' | 'asystole';
export type ArrestRhythm = ShockableRhythm | NonShockableRhythm;

export const SHOCKABLE_RHYTHMS: Rhythm[] = ['vfib', 'vtach'];
export const NON_SHOCKABLE_RHYTHMS: Rhythm[] = ['pea', 'asystole'];
export const ROSC_RHYTHMS: Rhythm[] = ['sinus', 'sinus_brady', 'sinus_tachy'];

export const RHYTHM_LABELS: Record<Rhythm, string> = {
  vfib: 'Ventricular Fibrillation',
  vtach: 'Pulseless V-Tach',
  pea: 'PEA',
  asystole: 'Asystole',
  sinus: 'Normal Sinus Rhythm',
  sinus_brady: 'Sinus Bradycardia',
  sinus_tachy: 'Sinus Tachycardia',
};

export type ReversibleCause =
  | 'hypovolemia' | 'hypoxia' | 'acidosis' | 'hypokalemia'
  | 'hyperkalemia' | 'hypothermia' | 'tension_pneumo'
  | 'tamponade' | 'toxins' | 'pe' | 'mi';

export const REVERSIBLE_CAUSE_LABELS: Record<ReversibleCause, string> = {
  hypovolemia: 'Hypovolemia',
  hypoxia: 'Hypoxia',
  acidosis: 'Hydrogen Ion (Acidosis)',
  hypokalemia: 'Hypokalemia',
  hyperkalemia: 'Hyperkalemia',
  hypothermia: 'Hypothermia',
  tension_pneumo: 'Tension Pneumothorax',
  tamponade: 'Cardiac Tamponade',
  toxins: 'Toxins',
  pe: 'Pulmonary Embolism',
  mi: 'Myocardial Infarction',
};

export const H_CAUSES: ReversibleCause[] = ['hypovolemia', 'hypoxia', 'acidosis', 'hypokalemia', 'hyperkalemia', 'hypothermia'];
export const T_CAUSES: ReversibleCause[] = ['tension_pneumo', 'tamponade', 'toxins', 'pe', 'mi'];

export type TeamRole =
  | 'compressor' | 'airway' | 'iv_access' | 'medication'
  | 'monitor_defib' | 'recorder' | 'timekeeper' | 'none';

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  compressor: 'Chest Compressions',
  airway: 'Airway Management',
  iv_access: 'IV/IO Access',
  medication: 'Medication Admin',
  monitor_defib: 'Monitor/Defibrillator',
  recorder: 'Recorder',
  timekeeper: 'Timekeeper',
  none: 'Unassigned',
};

export type StaffType = 'nurse' | 'resident' | 'attending' | 'rt' | 'tech' | 'student' | 'pharmacist';

export const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  nurse: 'RN',
  resident: 'Resident',
  attending: 'Attending',
  rt: 'RT',
  tech: 'Tech',
  student: 'Student',
  pharmacist: 'PharmD',
};

export type Competence = 'low' | 'medium' | 'high';
export type Compliance = 'cooperative' | 'independent' | 'resistant';

export interface TeamMember {
  id: string;
  name: string;
  staffType: StaffType;
  competence: Competence;
  compliance: Compliance;
  assignedRole: TeamRole;
  confirmedRole: boolean;
  busy: boolean;
  busyUntil: number;
  speechBubble: string | null;
  speechBubbleUntil: number;
  inRoom: boolean;
  selfAssignedRole: TeamRole | null;
}

export type MedicationType = 'epinephrine' | 'amiodarone' | 'lidocaine' | 'atropine' | 'bicarb' | 'calcium' | 'magnesium';

export const MEDICATION_LABELS: Record<MedicationType, string> = {
  epinephrine: 'Epinephrine 1mg IV',
  amiodarone: 'Amiodarone',
  lidocaine: 'Lidocaine',
  atropine: 'Atropine 1mg IV',
  bicarb: 'Sodium Bicarbonate',
  calcium: 'Calcium Chloride',
  magnesium: 'Magnesium Sulfate',
};

export interface MedicationRecord {
  type: MedicationType;
  dose: string;
  timeGiven: number;
}

export interface PatientState {
  rhythm: Rhythm;
  hr: number;
  bp: { systolic: number; diastolic: number };
  spo2: number;
  etco2: number;
  hasIV: boolean;
  hasIO: boolean;
  hasAdvancedAirway: boolean;
  cprInProgress: boolean;
  cprQuality: number;
  lastRhythmCheck: number;
  lastPulseCheck: number;
  lastShock: number;
  shockCount: number;
  medications: MedicationRecord[];
  lastEpinephrine: number;
  amiodaroneDoses: number;
  reversibleCause: ReversibleCause;
  reversibleCauseIdentified: boolean;
  reversibleCauseTreated: boolean;
}

export type ComplicationType =
  | 'iv_lost' | 'equipment_failure' | 'family_arrives' | 'overcrowding'
  | 'rhythm_change' | 'staff_leaves' | 'cpr_fatigue' | 'difficult_airway'
  | 'new_staff_arrives' | 'lab_results';

export const COMPLICATION_LABELS: Record<ComplicationType, string> = {
  iv_lost: 'IV Access Lost',
  equipment_failure: 'Equipment Malfunction',
  family_arrives: 'Family at Bedside',
  overcrowding: 'Room Overcrowded',
  rhythm_change: 'Rhythm Change',
  staff_leaves: 'Staff Member Leaves',
  cpr_fatigue: 'Compressor Fatigued',
  difficult_airway: 'Difficult Airway',
  new_staff_arrives: 'New Staff Arrives',
  lab_results: 'Lab Results Available',
};

export interface ScheduledEvent {
  time: number;
  type: ComplicationType;
  data?: Record<string, unknown>;
  fired: boolean;
}

export interface ActionLogEntry {
  id: string;
  time: number;
  action: string;
  category: 'command' | 'event' | 'team' | 'system' | 'complication';
  details?: string;
}

export interface ScoreBreakdown {
  rhythmCheckTiming: number;
  epinephrineTiming: number;
  defibrillationTiming: number;
  medicationChoices: number;
  pulseChecks: number;
  closedLoopComm: number;
  teamManagement: number;
  reversibleCauses: number;
  overallLeadership: number;
  penalties: number;
  total: number;
}

export type GamePhase = 'menu' | 'briefing' | 'active' | 'paused' | 'ended' | 'debrief';

export interface Scenario {
  patientName: string;
  patientAge: number;
  patientSex: 'M' | 'F';
  patientWeight: number;
  chiefComplaint: string;
  pmh: string[];
  initialRhythm: ArrestRhythm;
  reversibleCause: ReversibleCause;
  roscAchievable: boolean;
  roscConditions: string;
  roscTime: number;
  scheduledEvents: ScheduledEvent[];
  initialTeam: TeamMember[];
  briefingText: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface StopwatchState {
  running: boolean;
  startTime: number;
  elapsed: number;
}

export interface GameState {
  phase: GamePhase;
  scenario: Scenario | null;
  patient: PatientState;
  team: TeamMember[];
  clock: number;
  running: boolean;
  actionLog: ActionLogEntry[];
  score: ScoreBreakdown;
  stopwatch: StopwatchState;
  rhythmChecksDone: number;
  pulseChecksDone: number;
  cprCycleStart: number;
  pendingCommands: string[];
  roomCapacity: number;
  closedLoopCount: number;
  closedLoopSuccess: number;
}

export type GameAction =
  | { type: 'START_SCENARIO'; scenario: Scenario }
  | { type: 'TICK'; delta: number }
  | { type: 'BEGIN_CODE' }
  | { type: 'ASSIGN_ROLE'; memberId: string; role: TeamRole }
  | { type: 'CONFIRM_ROLE'; memberId: string }
  | { type: 'ORDER_MEDICATION'; medication: MedicationType; dose: string }
  | { type: 'ORDER_SHOCK' }
  | { type: 'ORDER_RHYTHM_CHECK' }
  | { type: 'ORDER_PULSE_CHECK' }
  | { type: 'ORDER_CPR' }
  | { type: 'ORDER_STOP_CPR' }
  | { type: 'ORDER_AIRWAY'; advanced: boolean }
  | { type: 'ORDER_IV_ACCESS'; io: boolean }
  | { type: 'IDENTIFY_CAUSE'; cause: ReversibleCause }
  | { type: 'TREAT_CAUSE' }
  | { type: 'KICK_MEMBER'; memberId: string }
  | { type: 'CALL_TIME_OF_DEATH' }
  | { type: 'TOGGLE_STOPWATCH' }
  | { type: 'RESET_STOPWATCH' }
  | { type: 'PAUSE_GAME' }
  | { type: 'RESUME_GAME' }
  | { type: 'END_GAME'; reason: string }
  | { type: 'VIEW_DEBRIEF' }
  | { type: 'FIRE_EVENT'; event: ScheduledEvent }
  | { type: 'TEAM_SPEECH'; memberId: string; message: string; duration: number }
  | { type: 'CLEAR_SPEECH'; memberId: string }
  | { type: 'MEMBER_SELF_ASSIGN'; memberId: string; role: TeamRole }
  | { type: 'NEW_MEMBER_ARRIVES'; member: TeamMember }
  | { type: 'COMPLICATION_IV_LOST' }
  | { type: 'COMPLICATION_EQUIPMENT_FAILURE' }
  | { type: 'COMPLICATION_STAFF_LEAVES'; memberId: string }
  | { type: 'COMPLICATION_RHYTHM_CHANGE'; newRhythm: Rhythm }
  | { type: 'COMPLICATION_CPR_FATIGUE' };
