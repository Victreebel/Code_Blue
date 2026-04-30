import type { ScenarioInput } from '../types/scenario';
import { drawInt, fnv1a } from '../rng';

const SCENARIO_ID = 'witnessed_vf_rosc_v1';

export const SCENARIO_BRIEFING_TEXT = `WITNESSED CARDIAC ARREST — BED 4
Mr. James O'Neill, 58 yo M, weight 86 kg.
PMH: HTN, hyperlipidemia, prior NSTEMI 2024 with stent to LAD.
Admitted overnight with substernal chest pain, troponin 0.42 → 0.91.
On heparin drip, telemetry. Bedside RN witnessed sudden collapse 30 sec ago.
Telemetry strip shows ventricular fibrillation. No pulse confirmed.
You are the code leader. Pads are on. The team is converging.`;

export function buildWitnessedVfArrest(seedString: string): ScenarioInput {
  const seed = fnv1a(seedString);
  const [fatigueAt] = drawInt(seed, 60, 121);
  return {
    scenarioId: SCENARIO_ID,
    seed: seedString,
    initialRhythm: 'vfib',
    realTimeBudget: { minSeconds: 300, maxSeconds: 480 },
    patientName: "James O'Neill",
    patientAge: 58,
    patientSex: 'M',
    patientWeight: 86,
    chiefComplaint: 'Witnessed cardiac arrest — VF',
    pmh: ['HTN', 'Hyperlipidemia', 'NSTEMI 2024 (LAD stent)'],
    briefingText: SCENARIO_BRIEFING_TEXT,
    roomCapacity: 6,
    team: [
      {
        id: 'leader',
        name: 'YOU (Code Leader)',
        staffType: 'attending',
        archetypeId: 'reliable_rt',
        competence: 'high',
        compliance: 'cooperative',
        behavior: { initiative: 1, distractibility: 0, clarificationTendency: 0, executionSpeed: 1, assertiveness: 1 },
        initialRole: 'leader',
        isLeader: true,
      },
      {
        id: 'rn_primary',
        name: 'Sara (Charge RN)',
        staffType: 'nurse',
        archetypeId: 'experienced_nurse',
        competence: 'high',
        compliance: 'cooperative',
        behavior: { initiative: 0.8, distractibility: 0.1, clarificationTendency: 0.2, executionSpeed: 0.9, assertiveness: 0.7 },
        initialRole: 'medication',
        isLeader: false,
      },
      {
        id: 'rn_new',
        name: 'Megan (RN, 6 mo)',
        staffType: 'nurse',
        archetypeId: 'hesitant_new_nurse',
        competence: 'low',
        compliance: 'cooperative',
        behavior: { initiative: 0.15, distractibility: 0.4, clarificationTendency: 0.7, executionSpeed: 0.4, assertiveness: 0.1 },
        initialRole: 'recorder',
        isLeader: false,
      },
      {
        id: 'resident',
        name: 'Dr. Patel (PGY-2)',
        staffType: 'resident',
        archetypeId: 'eager_intern',
        competence: 'medium',
        compliance: 'cooperative',
        behavior: { initiative: 0.9, distractibility: 0.3, clarificationTendency: 0.1, executionSpeed: 0.7, assertiveness: 0.8 },
        initialRole: 'compressor',
        isLeader: false,
      },
      {
        id: 'rt',
        name: 'Tom (RT)',
        staffType: 'rt',
        archetypeId: 'reliable_rt',
        competence: 'high',
        compliance: 'cooperative',
        behavior: { initiative: 0.7, distractibility: 0.05, clarificationTendency: 0.15, executionSpeed: 0.85, assertiveness: 0.6 },
        initialRole: 'airway',
        isLeader: false,
      },
      {
        id: 'tech',
        name: 'Alex (PCT)',
        staffType: 'tech',
        archetypeId: 'distractible_intern',
        competence: 'low',
        compliance: 'cooperative',
        behavior: { initiative: 0.3, distractibility: 0.4, clarificationTendency: 0.2, executionSpeed: 0.6, assertiveness: 0.2 },
        initialRole: 'monitor_defib',
        isLeader: false,
      },
    ],
    scheduledChaos: [
      {
        type: 'compressor_fatigue',
        triggerKind: 'time',
        triggerAtSeconds: fatigueAt,
      },
      {
        type: 'medication_delay',
        triggerKind: 'on_first_medication',
        payload: { delaySeconds: 35 },
      },
    ],
  };
}

export const WITNESSED_VF_SCENARIO_ID = SCENARIO_ID;
