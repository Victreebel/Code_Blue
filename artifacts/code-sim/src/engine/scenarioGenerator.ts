import {
  type Scenario, type ArrestRhythm, type ReversibleCause, type TeamMember,
  type ScheduledEvent, type ComplicationType, type StaffType, type Competence,
  type Compliance, type TeamRole, type StaffArchetypeId, H_CAUSES, T_CAUSES,
  REVERSIBLE_CAUSE_LABELS,
} from './types';
import { STAFF_ARCHETYPES, getArchetypeForStaffType, getDefaultBehavior } from './staffArchetypes';

const FIRST_NAMES = ['James', 'Sarah', 'Mike', 'Emily', 'Carlos', 'Priya', 'David', 'Aisha', 'Kevin', 'Lisa', 'Omar', 'Jen', 'Tyler', 'Maria', 'Raj', 'Nina', 'Andre', 'Kim', 'Alex', 'Pat'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Wilson', 'Patel', 'Kim', 'Chen', 'Adams', 'Lee', 'Clark', 'Lewis', 'Young', 'Hall', 'Wright'];
const PATIENT_NAMES_FIRST = ['Robert', 'Dorothy', 'William', 'Margaret', 'Thomas', 'Helen', 'Richard', 'Betty', 'Charles', 'Ruth', 'George', 'Mildred', 'Frank', 'Virginia', 'Harold', 'Frances'];
const PATIENT_NAMES_LAST = ['Thompson', 'Anderson', 'Martinez', 'Robinson', 'Jackson', 'White', 'Harris', 'Thomas', 'Moore', 'Taylor', 'Martin', 'Walker'];

const CHIEF_COMPLAINTS: Record<ReversibleCause, string[]> = {
  hypovolemia: ['GI bleed with hematemesis', 'Post-surgical hemorrhage', 'Ruptured AAA', 'Trauma with internal bleeding'],
  hypoxia: ['Acute respiratory failure', 'Severe pneumonia', 'COPD exacerbation', 'Drowning victim'],
  acidosis: ['DKA', 'Severe sepsis', 'Renal failure with metabolic acidosis', 'Toxic ingestion'],
  hypokalemia: ['Chronic diuretic use, weakness', 'Severe vomiting/diarrhea', 'Found unresponsive, hx renal disease'],
  hyperkalemia: ['Missed dialysis x3', 'Acute kidney injury', 'Crush injury', 'ACE-I overdose with renal failure'],
  hypothermia: ['Found outside in cold weather', 'Near-drowning in cold water', 'Prolonged environmental exposure'],
  tension_pneumo: ['Chest trauma', 'Post-central line placement', 'Severe COPD with sudden decompensation', 'Penetrating chest wound'],
  tamponade: ['Chest pain, recent cardiac surgery', 'Penetrating chest trauma', 'Known pericardial effusion', 'Post-MI complications'],
  toxins: ['Intentional overdose', 'Accidental ingestion', 'Found with empty pill bottles', 'Opioid overdose'],
  pe: ['Post-operative DVT symptoms', 'Sudden dyspnea and collapse', 'Long flight, acute chest pain', 'Known malignancy with leg swelling'],
  mi: ['Acute chest pain radiating to jaw', 'STEMI on EMS ECG', 'Sudden cardiac arrest while exercising', 'Known CAD with acute symptoms'],
};

const PMH_OPTIONS: Record<ReversibleCause, string[]> = {
  hypovolemia: ['Peptic ulcer disease', 'Cirrhosis', 'Coagulopathy', 'Recent surgery'],
  hypoxia: ['COPD', 'CHF', 'Asthma', 'Pulmonary fibrosis'],
  acidosis: ['Type 1 Diabetes', 'CKD Stage IV', 'Chronic alcohol use'],
  hypokalemia: ['HTN on thiazide', 'Bulimia', 'Chronic diarrhea'],
  hyperkalemia: ['ESRD on HD', 'CKD Stage V', 'Adrenal insufficiency'],
  hypothermia: ['Dementia', 'Alcohol use disorder', 'Hypothyroidism'],
  tension_pneumo: ['COPD with bullae', 'Marfan syndrome', 'Recent thoracic procedure'],
  tamponade: ['Recent CABG', 'SLE', 'Renal failure on anticoag'],
  toxins: ['Depression', 'Chronic pain on opioids', 'Substance use disorder'],
  pe: ['DVT hx', 'Factor V Leiden', 'Recent hip replacement'],
  mi: ['CAD', 'HTN', 'DM2', 'Hyperlipidemia', 'Prior MI', 'Smoker'],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomId(): string {
  return Math.random().toString(36).substr(2, 8);
}

function generateTeamMember(staffType: StaffType, excludeNames: Set<string>, forcedArchetype?: StaffArchetypeId): TeamMember {
  let name: string;
  do {
    name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES).charAt(0)}.`;
  } while (excludeNames.has(name));
  excludeNames.add(name);

  const archetypeId = forcedArchetype ?? getArchetypeForStaffType(staffType);
  const archetype = archetypeId ? STAFF_ARCHETYPES[archetypeId] : null;

  const competenceMap: Record<StaffType, Competence[]> = {
    attending: ['high', 'high', 'medium'],
    resident: ['medium', 'medium', 'low', 'high'],
    nurse: ['high', 'medium', 'medium', 'low'],
    rt: ['high', 'medium'],
    tech: ['medium', 'low'],
    pharmacist: ['high', 'medium'],
    student: ['low', 'low', 'medium'],
  };

  const complianceMap: Record<StaffType, Compliance[]> = {
    attending: ['independent', 'independent', 'cooperative'],
    resident: ['cooperative', 'cooperative', 'independent'],
    nurse: ['cooperative', 'cooperative', 'independent', 'resistant'],
    rt: ['cooperative', 'cooperative'],
    tech: ['cooperative', 'resistant'],
    pharmacist: ['cooperative', 'independent'],
    student: ['cooperative', 'cooperative', 'cooperative'],
  };

  const selfAssignRole = archetype && archetype.behavior.initiative > 0.5 && Math.random() < archetype.behavior.initiative
    ? pick(archetype.preferredRoles) : null;

  return {
    id: randomId(),
    name,
    staffType,
    competence: archetype?.competence ?? pick(competenceMap[staffType]),
    compliance: archetype?.compliance ?? pick(complianceMap[staffType]),
    behavior: archetype?.behavior ?? getDefaultBehavior(),
    archetypeId: archetypeId,
    assignedRole: 'none',
    confirmedRole: false,
    busy: false,
    busyUntil: 0,
    speechBubble: null,
    speechBubbleUntil: 0,
    inRoom: true,
    selfAssignedRole: selfAssignRole,
    lastActionTime: 0,
    fatigueLevel: 0,
  };
}

function generateScheduledEvents(difficulty: 'easy' | 'medium' | 'hard', roscTime: number): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  const eventCounts = { easy: 3, medium: 5, hard: 8 };
  const count = eventCounts[difficulty];

  const possibleEvents: ComplicationType[] = [
    'cpr_fatigue', 'new_staff_arrives', 'lab_results', 'overcrowding',
    'iv_lost', 'equipment_failure', 'family_arrives', 'difficult_airway',
    'staff_leaves', 'rhythm_change',
  ];

  events.push({
    time: Math.floor(Math.random() * 30 + 60),
    type: 'cpr_fatigue',
    fired: false,
  });

  events.push({
    time: Math.floor(Math.random() * 60 + 90),
    type: 'new_staff_arrives',
    fired: false,
  });

  const remaining = count - 2;
  for (let i = 0; i < remaining; i++) {
    const time = Math.floor(Math.random() * (roscTime - 60) + 60);
    events.push({
      time,
      type: pick(possibleEvents),
      fired: false,
    });
  }

  events.sort((a, b) => a.time - b.time);
  return events;
}

export type SeedScenarioId = 'vfib_rosc' | 'pea_hypoxia' | 'asystole_crowd';

export interface SeedScenarioMeta {
  id: SeedScenarioId;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const SEED_SCENARIOS: SeedScenarioMeta[] = [
  {
    id: 'vfib_rosc',
    title: 'VF Arrest — ROSC Achievable',
    description: 'Classic VF arrest in a 62yo male with MI. Moderate staff. ROSC achievable with good resuscitation.',
    difficulty: 'medium',
  },
  {
    id: 'pea_hypoxia',
    title: 'PEA from Hypoxia',
    description: '48yo female with severe pneumonia. PEA arrest. RT arrives late. Conditionally salvageable if hypoxia treated.',
    difficulty: 'hard',
  },
  {
    id: 'asystole_crowd',
    title: 'Asystole — Overcrowded Room',
    description: '78yo male, asystole. Too many people in the room. ROSC not achievable. Test your room management.',
    difficulty: 'hard',
  },
];

function generateSeedScenario(seedId: SeedScenarioId): Scenario {
  const usedNames = new Set<string>();

  if (seedId === 'vfib_rosc') {
    const team: TeamMember[] = [
      generateTeamMember('nurse', usedNames, 'experienced_nurse'),
      generateTeamMember('nurse', usedNames, 'hesitant_new_nurse'),
      generateTeamMember('rt', usedNames, 'reliable_rt'),
      { ...generateTeamMember('tech', usedNames), competence: 'medium' },
    ];
    return {
      patientName: 'Robert Thompson',
      patientAge: 62,
      patientSex: 'M',
      patientWeight: 85,
      chiefComplaint: 'Acute chest pain radiating to jaw',
      pmh: ['CAD', 'HTN', 'Prior MI'],
      initialRhythm: 'vfib',
      reversibleCause: 'mi',
      roscAchievable: true,
      roscConditions: 'ROSC achievable after treating MI and adequate resuscitation for 6 minutes',
      roscTime: 360,
      scheduledEvents: [
        { time: 75, type: 'cpr_fatigue', fired: false },
        { time: 120, type: 'new_staff_arrives', fired: false },
        { time: 200, type: 'cpr_fatigue', fired: false },
        { time: 280, type: 'lab_results', fired: false },
      ],
      initialTeam: team,
      briefingText: 'Code Blue called. 62-year-old male patient, Robert Thompson, found unresponsive. Chief complaint: Acute chest pain radiating to jaw. PMH: CAD, HTN, Prior MI. No pulse detected. You are the code team leader.',
      difficulty: 'medium',
    };
  }

  if (seedId === 'pea_hypoxia') {
    const team: TeamMember[] = [
      generateTeamMember('nurse', usedNames, 'experienced_nurse'),
      generateTeamMember('nurse', usedNames, 'hesitant_new_nurse'),
      { ...generateTeamMember('tech', usedNames), competence: 'low' },
      generateTeamMember('resident', usedNames, 'distractible_intern'),
    ];
    return {
      patientName: 'Margaret Robinson',
      patientAge: 48,
      patientSex: 'F',
      patientWeight: 72,
      chiefComplaint: 'Severe pneumonia with acute respiratory failure',
      pmh: ['COPD', 'Asthma'],
      initialRhythm: 'pea',
      reversibleCause: 'hypoxia',
      roscAchievable: true,
      roscConditions: 'ROSC achievable if hypoxia addressed and adequate CPR maintained for 8 minutes',
      roscTime: 480,
      scheduledEvents: [
        { time: 90, type: 'cpr_fatigue', fired: false },
        { time: 150, type: 'difficult_airway', fired: false },
        { time: 180, type: 'new_staff_arrives', fired: false },
        { time: 240, type: 'iv_lost', fired: false },
        { time: 300, type: 'cpr_fatigue', fired: false },
        { time: 350, type: 'rhythm_change', fired: false },
        { time: 420, type: 'new_staff_arrives', fired: false },
      ],
      initialTeam: team,
      briefingText: 'Code Blue called. 48-year-old female patient, Margaret Robinson, found unresponsive. Chief complaint: Severe pneumonia with acute respiratory failure. PMH: COPD, Asthma. No pulse detected. You are the code team leader.',
      difficulty: 'hard',
    };
  }

  const team: TeamMember[] = [
    generateTeamMember('nurse', usedNames, 'experienced_nurse'),
    generateTeamMember('nurse', usedNames, 'hesitant_new_nurse'),
    generateTeamMember('nurse', usedNames),
    generateTeamMember('rt', usedNames, 'delayed_rt'),
    { ...generateTeamMember('tech', usedNames), competence: 'low' },
    generateTeamMember('resident', usedNames, 'eager_intern'),
    generateTeamMember('resident', usedNames, 'distractible_intern'),
    { ...generateTeamMember('student', usedNames), competence: 'low' },
    generateTeamMember('attending', usedNames, 'interfering_senior'),
  ];
  return {
    patientName: 'William Harris',
    patientAge: 78,
    patientSex: 'M',
    patientWeight: 95,
    chiefComplaint: 'Found unresponsive in bed, no preceding symptoms',
    pmh: ['CHF', 'ESRD on HD', 'DM2', 'Prior CVA'],
    initialRhythm: 'asystole',
    reversibleCause: 'hyperkalemia',
    roscAchievable: false,
    roscConditions: 'ROSC not achievable in this scenario',
    roscTime: 999999,
    scheduledEvents: [
      { time: 30, type: 'new_staff_arrives', fired: false },
      { time: 60, type: 'new_staff_arrives', fired: false },
      { time: 80, type: 'cpr_fatigue', fired: false },
      { time: 100, type: 'overcrowding', fired: false },
      { time: 120, type: 'family_arrives', fired: false },
      { time: 160, type: 'new_staff_arrives', fired: false },
      { time: 200, type: 'cpr_fatigue', fired: false },
      { time: 250, type: 'staff_leaves', fired: false },
    ],
    initialTeam: team,
    briefingText: 'Code Blue called. 78-year-old male patient, William Harris, found unresponsive in bed. PMH: CHF, ESRD on HD, DM2, Prior CVA. No pulse detected. Room is already crowded. You are the code team leader.',
    difficulty: 'hard',
  };
}

export function generateScenario(difficulty: 'easy' | 'medium' | 'hard' = 'medium', seedId?: SeedScenarioId): Scenario {
  if (seedId) return generateSeedScenario(seedId);
  const rhythms: ArrestRhythm[] = ['vfib', 'vtach', 'pea', 'asystole'];
  const initialRhythm = pick(rhythms);
  const allCauses = [...H_CAUSES, ...T_CAUSES];
  const reversibleCause = pick(allCauses);
  const roscAchievable = Math.random() > 0.2;
  const roscTime = roscAchievable
    ? Math.floor(Math.random() * 300 + 300)
    : 999999;

  const patientSex = Math.random() > 0.5 ? 'M' as const : 'F' as const;
  const patientAge = Math.floor(Math.random() * 50 + 30);
  const patientWeight = Math.floor(Math.random() * 40 + 60);
  const patientFirstName = pick(PATIENT_NAMES_FIRST);
  const patientLastName = pick(PATIENT_NAMES_LAST);

  const usedNames = new Set<string>();
  const coreTeam: StaffType[] = ['nurse', 'nurse', 'rt', 'tech'];
  if (difficulty !== 'easy') coreTeam.push('nurse');
  if (difficulty === 'hard') coreTeam.push('resident', 'student');

  const initialTeam = coreTeam.map(st => generateTeamMember(st, usedNames));

  const scheduledEvents = generateScheduledEvents(difficulty, roscTime);
  const complaint = pick(CHIEF_COMPLAINTS[reversibleCause]);
  const pmh = pickN(PMH_OPTIONS[reversibleCause], Math.floor(Math.random() * 2 + 1));

  const roscConditions = roscAchievable
    ? `ROSC achievable after treating ${REVERSIBLE_CAUSE_LABELS[reversibleCause]} and adequate resuscitation for ${Math.floor(roscTime / 60)} minutes`
    : 'ROSC not achievable in this scenario';

  const briefingText = `Code Blue called. ${patientAge}-year-old ${patientSex === 'M' ? 'male' : 'female'} patient, ${patientFirstName} ${patientLastName}, found unresponsive. Chief complaint: ${complaint}. PMH: ${pmh.join(', ')}. No pulse detected. You are the code team leader.`;

  return {
    patientName: `${patientFirstName} ${patientLastName}`,
    patientAge,
    patientSex,
    patientWeight,
    chiefComplaint: complaint,
    pmh,
    initialRhythm,
    reversibleCause,
    roscAchievable,
    roscConditions,
    roscTime,
    scheduledEvents,
    initialTeam,
    briefingText,
    difficulty,
  };
}

export function generateNewTeamMember(usedNames: Set<string>): TeamMember {
  const types: StaffType[] = ['nurse', 'resident', 'tech', 'student', 'pharmacist'];
  return generateTeamMember(pick(types), usedNames);
}
