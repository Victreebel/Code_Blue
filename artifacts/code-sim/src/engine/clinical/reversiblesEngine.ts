import type { ReversibleCauseId } from '../types/core';
import type { ReversibleCauseState, CauseStatus } from '../types/clinical';

export type InvestigationId =
  | 'iv_access'
  | 'io_access'
  | 'blood_draw'
  | 'poc_glucose'
  | 'vbg_istat'
  | 'bmp'
  | 'ecg_12lead'
  | 'pocus'
  | 'chest_xray'
  | 'capnography'
  | 'core_temp'
  | 'medication_review'
  | 'tox_screen'
  | 'rhythm_check'
  | 'pulse_check'
  | 'airway_bvm'
  | 'airway_advanced'
  | 'cpr_start'
  | 'cpr_pause'
  | 'compressor_switch'
  | 'charge_defib'
  | 'shock'
  | 'medication'
  | 'announce_cycle'
  | 'closed_loop_request';

export interface CauseMapping {
  causeId: ReversibleCauseId;
  label: string;
  requiredInvestigations: InvestigationId[];
  withUSClue?: string;
  withoutUSClue?: string;
  interventions: string[];
  canRuleOut: boolean;
  /* Without US, this cause can only be solved via exclusion + empiric intervention */
  exclusionOnlyWithoutUS?: boolean;
  /* ECG must NOT complete this cause */
  ecgCannotComplete?: boolean;
  /* Specific exclusions that turn this green */
  exclusionInvestigations?: InvestigationId[];
}

export const CAUSE_MAPPINGS: CauseMapping[] = [
  {
    causeId: 'hypovolemia',
    label: 'Hypovolemia',
    requiredInvestigations: ['iv_access', 'io_access', 'blood_draw', 'vbg_istat', 'pocus'],
    withUSClue: 'Flat/collapsing IVC + empty hyperdynamic LV',
    withoutUSClue: 'Bleed/trauma/GI history, low Hgb on iStat, rising lactate, response to bolus',
    interventions: ['Fluid bolus', 'Blood products', 'Hemorrhage control'],
    canRuleOut: true,
    exclusionInvestigations: ['pocus', 'blood_draw', 'vbg_istat'],
  },
  {
    causeId: 'hypoxia',
    label: 'Hypoxia',
    requiredInvestigations: ['capnography', 'airway_bvm', 'airway_advanced', 'pulse_check'],
    withUSClue: 'Not applicable — exam-based',
    withoutUSClue: 'ETCO2, tube confirmation, bilateral breath sounds, response to O2',
    interventions: ['Secure/confirm airway', 'High-quality ventilation'],
    canRuleOut: true,
    exclusionInvestigations: ['capnography', 'airway_advanced'],
  },
  {
    causeId: 'acidosis',
    label: 'Acidosis (H+)',
    requiredInvestigations: ['vbg_istat', 'capnography', 'medication_review'],
    withUSClue: 'Not applicable — lab-based',
    withoutUSClue: 'VBG pH/bicarb, ETCO2 trend, history (DKA/sepsis/renal)',
    interventions: ['Optimize ventilation', 'Bicarbonate in select cases', 'Treat underlying'],
    canRuleOut: true,
    exclusionInvestigations: ['vbg_istat', 'medication_review'],
  },
  {
    causeId: 'hyperkalemia',
    label: 'Hyperkalemia',
    requiredInvestigations: ['ecg_12lead', 'vbg_istat', 'medication_review'],
    withUSClue: 'Not applicable — ECG + iStat',
    withoutUSClue: 'ECG: peaked T → wide QRS → sine wave; iStat K+, renal/dialysis/crush history',
    interventions: ['Calcium', 'Insulin + dextrose', 'Bicarbonate', 'Albuterol'],
    canRuleOut: true,
    ecgCannotComplete: false,
    exclusionInvestigations: ['ecg_12lead', 'vbg_istat'],
  },
  {
    causeId: 'hypokalemia',
    label: 'Hypokalemia',
    requiredInvestigations: ['ecg_12lead', 'vbg_istat'],
    withUSClue: 'Not applicable — ECG + iStat',
    withoutUSClue: 'ECG: U waves, flat T; iStat K+',
    interventions: ['K repletion', 'Magnesium'],
    canRuleOut: true,
    exclusionInvestigations: ['ecg_12lead', 'vbg_istat'],
  },
  {
    causeId: 'hypothermia',
    label: 'Hypothermia',
    requiredInvestigations: ['core_temp', 'ecg_12lead', 'medication_review'],
    withUSClue: 'Not applicable — temp + ECG',
    withoutUSClue: 'Core temp, ECG Osborn J waves, history',
    interventions: ['Active rewarming', 'Prolonged resuscitation'],
    canRuleOut: true,
    exclusionInvestigations: ['core_temp'],
  },
  {
    causeId: 'tension_pneumothorax',
    label: 'Tension Pneumothorax',
    requiredInvestigations: ['pocus', 'pulse_check', 'capnography'],
    withUSClue: 'Absent lung sliding, barcode sign, lung point',
    withoutUSClue: 'Absent unilateral breath sounds, hard to bag / rising airway pressure, hyperresonance, late tracheal deviation, mechanism',
    interventions: ['Needle decompression', 'Finger thoracostomy'],
    canRuleOut: true,
    exclusionInvestigations: ['pocus', 'pulse_check', 'capnography'],
  },
  {
    causeId: 'tamponade',
    label: 'Cardiac Tamponade',
    requiredInvestigations: ['pocus', 'pulse_check', 'medication_review'],
    withUSClue: 'Pericardial effusion + diastolic RV collapse',
    withoutUSClue: 'JVD, muffled tones, narrow pulse pressure, history (malignancy/uremia/recent MI or procedure/trauma); diagnosis of exclusion → empiric pericardiocentesis',
    interventions: ['Pericardiocentesis'],
    canRuleOut: true,
    ecgCannotComplete: true,
    exclusionOnlyWithoutUS: true,
    exclusionInvestigations: ['pocus', 'pulse_check', 'medication_review'],
  },
  {
    causeId: 'toxins',
    label: 'Toxins',
    requiredInvestigations: ['medication_review', 'poc_glucose', 'tox_screen', 'ecg_12lead'],
    withUSClue: 'Not applicable — history + ECG + tox',
    withoutUSClue: 'Toxidrome pattern, glucose (hypoglycemic agents), response to antidote, ECG (wide QRS/long QT)',
    interventions: ['Specific antidote', 'Bicarbonate for Na-channel', 'Lipid emulsion'],
    canRuleOut: true,
    exclusionInvestigations: ['medication_review', 'tox_screen', 'poc_glucose'],
  },
  {
    causeId: 'thrombosis_pe',
    label: 'Thrombosis — PE',
    requiredInvestigations: ['medication_review', 'capnography', 'pocus', 'ecg_12lead'],
    withUSClue: 'RV strain (D-sign), McConnell\'s, IVC plethora, DVT',
    withoutUSClue: 'Risk factors, low ETCO2 despite good CPR, sudden PEA; ECG (S1Q3T3) suggestive not diagnostic',
    interventions: ['Consider thrombolytics', 'Prolonged CPR'],
    canRuleOut: true,
    exclusionInvestigations: ['pocus', 'ecg_12lead', 'capnography'],
  },
  {
    causeId: 'thrombosis_mi',
    label: 'Thrombosis — MI',
    requiredInvestigations: ['ecg_12lead', 'medication_review', 'blood_draw'],
    withUSClue: 'Regional wall-motion abnormality',
    withoutUSClue: '12-lead ECG (largely post-ROSC), history, troponin',
    interventions: ['Post-ROSC PCI/cath', 'Antiplatelets'],
    canRuleOut: true,
    exclusionInvestigations: ['ecg_12lead', 'blood_draw'],
  },
];

export const INVESTIGATION_LABELS: Record<string, string> = {
  iv_access: 'IV Access',
  io_access: 'IO Access',
  blood_draw: 'Blood draw',
  poc_glucose: 'Glucose',
  vbg_istat: 'VBG/iStat',
  bmp: 'BMP',
  ecg_12lead: '12-lead ECG',
  pocus: 'POCUS',
  chest_xray: 'Chest X-ray',
  capnography: 'Capnography',
  core_temp: 'Core temp',
  medication_review: 'Med/History review',
  tox_screen: 'Tox screen',
  rhythm_check: 'Rhythm check',
  pulse_check: 'Pulse check',
  airway_bvm: 'BVM',
  airway_advanced: 'Advanced airway',
};

export function computeCauseStatus(
  cause: ReversibleCauseState,
  mapping: CauseMapping,
  hasUltrasound: boolean,
  isArrest: boolean,
): CauseStatus {
  // Already green? Stay green.
  if (cause.status === 'green') return 'green';

  // Already ruled out?
  if (cause.ruledOut) return 'green';

  // Already treated?
  if (cause.treated) return 'green';

  const invs = cause.investigationsDone;
  const inters = cause.interventionsDone;

  // Special: Tamponade — ECG can NEVER complete this
  if (mapping.ecgCannotComplete) {
    const ecgOnly = invs.length === 1 && invs[0] === 'ecg_12lead';
    if (ecgOnly) return 'red';
  }

  // Special: Tamponade without US — only via exclusion + empiric pericardiocentesis
  if (mapping.exclusionOnlyWithoutUS && !hasUltrasound) {
    // Without US, need all exclusion investigations + empiric intervention
    const excl = mapping.exclusionInvestigations ?? [];
    const allExclDone = excl.length > 0 && excl.every(id => invs.includes(id as InvestigationId));
    const hasEmpiric = inters.includes('Pericardiocentesis');
    if (allExclDone && hasEmpiric) return 'green';
    if (allExclDone || hasEmpiric) return 'yellow';
    return 'red';
  }

  // Normal path: enough investigations + at least one intervention = green
  const required = mapping.requiredInvestigations;
  const doneCount = required.filter(id => invs.includes(id)).length;
  const hasIntervention = mapping.interventions.some(i => inters.includes(i));

  // If enough investigations done and an intervention applied = green
  const threshold = Math.max(2, Math.floor(required.length * 0.6));
  if (doneCount >= threshold && hasIntervention) return 'green';

  // If enough investigations to rule out = green
  if (mapping.canRuleOut && mapping.exclusionInvestigations) {
    const excl = mapping.exclusionInvestigations;
    const allExclDone = excl.every(id => invs.includes(id as InvestigationId));
    if (allExclDone) return 'green';
  }

  // In progress = yellow
  if (doneCount > 0 || hasIntervention) return 'yellow';

  return 'red';
}

export function recordInvestigation(
  reversibles: Record<string, ReversibleCauseState>,
  invId: InvestigationId,
  hasUltrasound: boolean,
  isArrest: boolean,
): Record<string, ReversibleCauseState> {
  const out: Record<string, ReversibleCauseState> = {};
  for (const [id, cause] of Object.entries(reversibles)) {
    const mapping = CAUSE_MAPPINGS.find(m => m.causeId === id);
    if (!mapping) { out[id] = cause; continue; }

    const invs = cause.investigationsDone.includes(invId)
      ? cause.investigationsDone
      : [...cause.investigationsDone, invId];

    const next: ReversibleCauseState = {
      ...cause,
      investigationsDone: invs,
    };
    next.status = computeCauseStatus(next, mapping, hasUltrasound, isArrest);
    if (next.status === 'green' && !cause.ruledOut && !cause.treated) {
      // Check if ruled out vs treated
      if (mapping.canRuleOut && mapping.exclusionInvestigations) {
        const excl = mapping.exclusionInvestigations;
        const allExclDone = excl.every(i => invs.includes(i as InvestigationId));
        if (allExclDone && !mapping.interventions.some(i => next.interventionsDone.includes(i))) {
          next.ruledOut = true;
        }
      }
    }
    out[id] = next;
  }
  return out;
}

export function recordIntervention(
  reversibles: Record<string, ReversibleCauseState>,
  intervention: string,
  hasUltrasound: boolean,
  isArrest: boolean,
): Record<string, ReversibleCauseState> {
  const out: Record<string, ReversibleCauseState> = {};
  for (const [id, cause] of Object.entries(reversibles)) {
    const mapping = CAUSE_MAPPINGS.find(m => m.causeId === id);
    if (!mapping) { out[id] = cause; continue; }

    const inters = cause.interventionsDone.includes(intervention)
      ? cause.interventionsDone
      : [...cause.interventionsDone, intervention];

    const next: ReversibleCauseState = {
      ...cause,
      interventionsDone: inters,
    };
    next.status = computeCauseStatus(next, mapping, hasUltrasound, isArrest);
    if (next.status === 'green' && !cause.ruledOut && !cause.treated) {
      next.treated = true;
    }
    out[id] = next;
  }
  return out;
}
