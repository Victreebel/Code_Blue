import { type BehaviorProfile, type StaffArchetypeId, type StaffType, type Competence, type Compliance, type TeamRole } from './types';

export interface StaffArchetype {
  id: StaffArchetypeId;
  label: string;
  staffType: StaffType;
  competence: Competence;
  compliance: Compliance;
  behavior: BehaviorProfile;
  preferredRoles: TeamRole[];
  spontaneousActions: string[];
  clarificationPhrases: string[];
  delayPhrases: string[];
  wrongTaskPhrases: string[];
}

export const STAFF_ARCHETYPES: Record<StaffArchetypeId, StaffArchetype> = {
  experienced_nurse: {
    id: 'experienced_nurse',
    label: 'Experienced Bedside Nurse',
    staffType: 'nurse',
    competence: 'high',
    compliance: 'cooperative',
    behavior: { initiative: 0.8, distractibility: 0.1, clarificationTendency: 0.2, executionSpeed: 0.9, assertiveness: 0.7 },
    preferredRoles: ['compressor', 'medication', 'iv_access'],
    spontaneousActions: [
      "I'll start compressions, someone get the pads on.",
      'Drawing up epi now.',
      "I'm getting a second line in the other arm.",
      'Let me suction before you try again.',
    ],
    clarificationPhrases: [
      'Did you want epi or amio?',
      'One or two amps of bicarb?',
    ],
    delayPhrases: [],
    wrongTaskPhrases: [],
  },
  hesitant_new_nurse: {
    id: 'hesitant_new_nurse',
    label: 'Hesitant New Nurse',
    staffType: 'nurse',
    competence: 'low',
    compliance: 'cooperative',
    behavior: { initiative: 0.15, distractibility: 0.4, clarificationTendency: 0.7, executionSpeed: 0.4, assertiveness: 0.1 },
    preferredRoles: ['recorder', 'timekeeper'],
    spontaneousActions: [],
    clarificationPhrases: [
      'Sorry, which med did you say?',
      'Did you say IV or IO?',
      'Am I giving this push or drip?',
      "I've never pushed amiodarone before... is it fast push?",
      'Wait, how many milligrams?',
    ],
    delayPhrases: [
      "I'm trying, the crash cart drawer is stuck...",
      "I can't find the amiodarone...",
      'Give me a second, I need to check the dose...',
      "I'm looking for tubing...",
    ],
    wrongTaskPhrases: [
      'Wait, I thought you said atropine?',
      'I already drew up lidocaine, is that what you wanted?',
    ],
  },
  reliable_rt: {
    id: 'reliable_rt',
    label: 'Reliable RT',
    staffType: 'rt',
    competence: 'high',
    compliance: 'cooperative',
    behavior: { initiative: 0.7, distractibility: 0.05, clarificationTendency: 0.15, executionSpeed: 0.85, assertiveness: 0.6 },
    preferredRoles: ['airway'],
    spontaneousActions: [
      'I have the airway, bagging with good chest rise.',
      'EtCO2 is connected. I\'ll call out changes.',
      "Sats are dropping, I'm going to suction.",
      'I have a 7.5 ET tube ready when you want to intubate.',
    ],
    clarificationPhrases: [
      'Do you want me to intubate or keep bagging?',
    ],
    delayPhrases: [],
    wrongTaskPhrases: [],
  },
  delayed_rt: {
    id: 'delayed_rt',
    label: 'Delayed RT',
    staffType: 'rt',
    competence: 'medium',
    compliance: 'cooperative',
    behavior: { initiative: 0.2, distractibility: 0.5, clarificationTendency: 0.3, executionSpeed: 0.35, assertiveness: 0.2 },
    preferredRoles: ['airway'],
    spontaneousActions: [],
    clarificationPhrases: [
      'Which size tube did you want?',
      'Should I set up for a surgical airway?',
    ],
    delayPhrases: [
      'I need to get my equipment from the other room...',
      "I'm having trouble getting suction set up...",
      "The O2 tank is almost empty, let me switch it out...",
      'Give me a minute, the blade isn\'t fitting the handle...',
    ],
    wrongTaskPhrases: [
      'I already set up for an LMA, did you want the ET tube?',
    ],
  },
  eager_intern: {
    id: 'eager_intern',
    label: 'Eager Intern',
    staffType: 'resident',
    competence: 'medium',
    compliance: 'cooperative',
    behavior: { initiative: 0.9, distractibility: 0.3, clarificationTendency: 0.1, executionSpeed: 0.7, assertiveness: 0.8 },
    preferredRoles: ['compressor', 'monitor_defib', 'iv_access'],
    spontaneousActions: [
      "I'll do compressions!",
      'Should I push the epi? I can do it.',
      "I'll intubate!",
      'I think we should shock again.',
      "I can get a femoral line if we can't get peripheral access.",
    ],
    clarificationPhrases: [],
    delayPhrases: [],
    wrongTaskPhrases: [
      'I already started pushing the bicarb — was that okay?',
      'I tried to intubate but I couldn\'t see anything...',
    ],
  },
  distractible_intern: {
    id: 'distractible_intern',
    label: 'Distractible Intern',
    staffType: 'resident',
    competence: 'low',
    compliance: 'cooperative',
    behavior: { initiative: 0.3, distractibility: 0.8, clarificationTendency: 0.4, executionSpeed: 0.3, assertiveness: 0.2 },
    preferredRoles: ['recorder', 'timekeeper'],
    spontaneousActions: [],
    clarificationPhrases: [
      'Sorry, who are you talking to?',
      'Wait, what did you need me to do?',
      'Can you repeat that?',
    ],
    delayPhrases: [
      "I got distracted charting, what's happening?",
      'Sorry, I was on my phone — pager went off.',
      'I was talking to the family, what did I miss?',
    ],
    wrongTaskPhrases: [
      'I was recording but I stopped to help with compressions...',
      'I thought someone else was doing that.',
    ],
  },
  efficient_pharmacist: {
    id: 'efficient_pharmacist',
    label: 'Efficient Pharmacist',
    staffType: 'pharmacist',
    competence: 'high',
    compliance: 'cooperative',
    behavior: { initiative: 0.6, distractibility: 0.05, clarificationTendency: 0.3, executionSpeed: 0.95, assertiveness: 0.5 },
    preferredRoles: ['medication'],
    spontaneousActions: [
      'Next epi is drawn up and ready.',
      'Amiodarone 300mg is mixed, ready to go.',
      "I'll keep track of med timing.",
      "It's been 4 minutes since last epi — due for another dose.",
    ],
    clarificationPhrases: [
      'Just to confirm — amiodarone 300 IV push?',
      'Do you want the second dose at 150?',
      'Bicarb dose — one amp or weight-based?',
    ],
    delayPhrases: [],
    wrongTaskPhrases: [],
  },
  interfering_senior: {
    id: 'interfering_senior',
    label: 'Interfering Senior',
    staffType: 'attending',
    competence: 'high',
    compliance: 'independent',
    behavior: { initiative: 0.95, distractibility: 0.15, clarificationTendency: 0.05, executionSpeed: 0.8, assertiveness: 0.95 },
    preferredRoles: ['airway', 'monitor_defib'],
    spontaneousActions: [
      "You need to shock now, what are you waiting for?",
      "Why hasn't epi been given yet?",
      'I think you should intubate. Let me do it.',
      'Have you considered hyperkalemia? Give calcium.',
      "Compression rate is too fast, slow it down.",
      "You've been running this code for too long. Consider calling it.",
    ],
    clarificationPhrases: [],
    delayPhrases: [],
    wrongTaskPhrases: [
      'I went ahead and intubated — someone had to.',
      "I already told the nurse to give calcium, that's the problem here.",
    ],
  },
};

export function getArchetypeForStaffType(staffType: StaffType): StaffArchetypeId | null {
  const candidates = Object.values(STAFF_ARCHETYPES).filter(a => a.staffType === staffType);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].id;
}

export function getDefaultBehavior(): BehaviorProfile {
  return {
    initiative: 0.4,
    distractibility: 0.2,
    clarificationTendency: 0.2,
    executionSpeed: 0.6,
    assertiveness: 0.4,
  };
}
