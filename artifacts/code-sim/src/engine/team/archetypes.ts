import type { TeamRole, StaffType, Competence, Compliance } from '../types/core';
import type { BehaviorProfile, StaffArchetypeId } from '../types/scenario';

export interface StaffArchetype {
  id: StaffArchetypeId;
  label: string;
  staffType: StaffType;
  competence: Competence;
  compliance: Compliance;
  behavior: BehaviorProfile;
  preferredRoles: TeamRole[];
  spontaneousActions: string[];
  acknowledgmentPhrases: string[];
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
      "Pads are on, ready to analyze when you are.",
    ],
    acknowledgmentPhrases: [
      'On it.',
      'Got it.',
      'Copy that.',
      'Right away.',
      'Done.',
    ],
    clarificationPhrases: ['Did you want epi or amio?', 'One or two amps of bicarb?'],
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
    spontaneousActions: [
      'Um — what do you need me to do?',
      "I'm here, just tell me where to go.",
      'Should I be recording? I can record.',
      "I don't know where they keep the amiodarone here...",
      "Sorry — I'm still getting oriented.",
    ],
    acknowledgmentPhrases: [
      'Okay... okay, I think I can do that.',
      'Got it, I — I think.',
      "I'll try.",
      'Okay, working on it.',
      'Um, yes — on it.',
    ],
    clarificationPhrases: [
      'Sorry, which med did you say?',
      'Did you say IV or IO?',
      'Am I giving this push or drip?',
      'Wait, how many milligrams?',
    ],
    delayPhrases: [
      "I'm trying, the crash cart drawer is stuck...",
      "I can't find the amiodarone...",
      'Give me a second, I need to check the dose...',
    ],
    wrongTaskPhrases: ['Wait, I thought you said atropine?'],
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
      "EtCO2 is connected. I'll call out changes.",
      "Sats are dropping, I'm going to suction.",
      "Airway's secure, ventilating at 10 per minute.",
    ],
    acknowledgmentPhrases: [
      'Got it.',
      'On it.',
      'Copy.',
      'Understood.',
      'Airway secured.',
    ],
    clarificationPhrases: ['Do you want me to intubate or keep bagging?'],
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
    spontaneousActions: [
      "I'm still getting my equipment ready...",
      "Sorry, I was on a different floor — what do you need?",
      "Is someone bagging? I can take over when I'm set up.",
      "Just got here, give me a second to get my bearings.",
      "My bag-valve's in the hall, one moment.",
    ],
    acknowledgmentPhrases: [
      "I'll get to it.",
      'Working on it.',
      "Okay, I'm on it.",
      'Give me a moment.',
      'Got it... just a second.',
    ],
    clarificationPhrases: ['Which size tube did you want?'],
    delayPhrases: [
      'I need to get my equipment from the other room...',
      "I'm having trouble getting suction set up...",
    ],
    wrongTaskPhrases: ['I already set up for an LMA, did you want the ET tube?'],
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
      "Want me on the monitor? I'll watch the rhythm.",
      "I can get the IV — I'm fast with those.",
    ],
    acknowledgmentPhrases: [
      'On it!',
      'Got it, doing it now!',
      "I'm on it.",
      'Yes! On it.',
      'Done — already on it.',
    ],
    clarificationPhrases: [],
    delayPhrases: [],
    wrongTaskPhrases: [
      'I already started pushing the bicarb — was that okay?',
      "I tried to intubate but I couldn't see anything...",
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
    spontaneousActions: [
      "Sorry — what's happening? What do you need?",
      "Is someone on compressions already?",
      "I got paged but I'm here — where should I be?",
      "What role am I doing?",
      "Should I be charting this?",
    ],
    acknowledgmentPhrases: [
      'Oh — yeah, on it.',
      'Got it, sorry.',
      "Okay, I'm doing it.",
      'Right, right. On it.',
      "Got it. Give me a sec.",
    ],
    clarificationPhrases: [
      'Sorry, who are you talking to?',
      'Wait, what did you need me to do?',
      'Can you repeat that?',
    ],
    delayPhrases: [
      "I got distracted charting, what's happening?",
      'Sorry, I was on my phone — pager went off.',
    ],
    wrongTaskPhrases: ['I thought someone else was doing that.'],
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
      "Epi's due in about 2 minutes if you want it.",
    ],
    acknowledgmentPhrases: [
      'Drawing it up now.',
      'On it.',
      'Got it.',
      'Mixing it now.',
      'Ready in 30 seconds.',
    ],
    clarificationPhrases: [
      'Just to confirm — amiodarone 300 IV push?',
      'Do you want the second dose at 150?',
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
      'You need to shock now, what are you waiting for?',
      "Why hasn't epi been given yet?",
      'Have you considered hyperkalemia? Give calcium.',
      "Compression rate is too fast, slow it down.",
      "Is this team even certified? Someone call a real code.",
    ],
    acknowledgmentPhrases: [
      "I already handled it.",
      "Obviously.",
      "Done — I did it myself.",
      'Already on it.',
    ],
    clarificationPhrases: [],
    delayPhrases: [],
    wrongTaskPhrases: [
      'I went ahead and intubated — someone had to.',
    ],
  },
};

export function getArchetype(id: StaffArchetypeId): StaffArchetype {
  return STAFF_ARCHETYPES[id];
}
