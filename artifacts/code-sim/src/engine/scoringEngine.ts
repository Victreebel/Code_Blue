import { type GameState, type ScoreBreakdown, type DebriefAnalysis, type FailureDomain, ROSC_RHYTHMS } from './types';
import { EPI_MIN_INTERVAL, EPI_MAX_INTERVAL, CPR_CYCLE_DURATION, isShockable } from './aclsProtocol';

export function calculateScore(state: GameState): ScoreBreakdown {
  const score: ScoreBreakdown = {
    rhythmCheckTiming: 0,
    epinephrineTiming: 0,
    defibrillationTiming: 0,
    medicationChoices: 0,
    pulseChecks: 0,
    closedLoopComm: 0,
    teamManagement: 0,
    reversibleCauses: 0,
    overallLeadership: 0,
    roomControl: 0,
    penalties: 0,
    total: 0,
  };

  if (!state.scenario) return score;

  score.rhythmCheckTiming = scoreRhythmChecks(state);
  score.epinephrineTiming = scoreEpinephrine(state);
  score.defibrillationTiming = scoreDefibrillation(state);
  score.medicationChoices = scoreMedications(state);
  score.pulseChecks = scorePulseChecks(state);
  score.closedLoopComm = scoreClosedLoop(state);
  score.teamManagement = scoreTeamManagement(state);
  score.reversibleCauses = scoreReversibleCauses(state);
  score.overallLeadership = scoreLeadership(state);
  score.roomControl = scoreRoomControl(state);

  score.total = Math.max(0, Math.min(100,
    score.rhythmCheckTiming +
    score.epinephrineTiming +
    score.defibrillationTiming +
    score.medicationChoices +
    score.pulseChecks +
    score.closedLoopComm +
    score.teamManagement +
    score.reversibleCauses +
    score.overallLeadership +
    score.roomControl +
    score.penalties
  ));

  return score;
}

function scoreRhythmChecks(state: GameState): number {
  if (state.rhythmChecksDone === 0) return 0;
  const expectedChecks = Math.floor(state.clock / CPR_CYCLE_DURATION);
  if (expectedChecks === 0) return 12;
  const ratio = Math.min(state.rhythmChecksDone / expectedChecks, 1);
  return Math.floor(ratio * 12);
}

function scoreEpinephrine(state: GameState): number {
  const epiDoses = state.patient.medications.filter(m => m.type === 'epinephrine');
  if (epiDoses.length === 0) {
    if (state.clock > EPI_MAX_INTERVAL) return 0;
    return 8;
  }

  let points = 4;
  for (let i = 1; i < epiDoses.length; i++) {
    const interval = epiDoses[i].timeGiven - epiDoses[i - 1].timeGiven;
    if (interval >= EPI_MIN_INTERVAL && interval <= EPI_MAX_INTERVAL) {
      points += 3;
    } else if (interval >= EPI_MIN_INTERVAL - 30 && interval <= EPI_MAX_INTERVAL + 60) {
      points += 1;
    }
  }

  return Math.min(12, points);
}

function scoreDefibrillation(state: GameState): number {
  if (!state.scenario) return 0;
  const initialShockable = isShockable(state.scenario.initialRhythm);
  if (!initialShockable) return 10;

  if (state.patient.shockCount === 0) return 0;

  const log = state.actionLog;
  const firstShock = log.find(l => l.action.includes('Shock delivered'));
  if (!firstShock) return 0;

  if (firstShock.time < 30) return 12;
  if (firstShock.time < 60) return 8;
  if (firstShock.time < 120) return 4;
  return 2;
}

function scoreMedications(state: GameState): number {
  const meds = state.patient.medications;
  if (meds.length === 0) return 0;

  let points = 0;
  const hasEpi = meds.some(m => m.type === 'epinephrine');
  if (hasEpi) points += 4;

  if (state.scenario && isShockable(state.scenario.initialRhythm)) {
    const hasAmio = meds.some(m => m.type === 'amiodarone');
    if (hasAmio && state.patient.shockCount >= 1) points += 4;
  }

  return Math.min(8, points);
}

function scoreClosedLoop(state: GameState): number {
  if (state.closedLoopCount === 0) return 4;
  const ratio = state.closedLoopSuccess / state.closedLoopCount;
  return Math.floor(ratio * 12);
}

function scoreTeamManagement(state: GameState): number {
  let points = 0;
  const assignedRoles = state.team.filter(m => m.assignedRole !== 'none');
  if (assignedRoles.length >= 3) points += 4;
  if (assignedRoles.length >= 5) points += 2;

  const hasTimekeeper = state.team.some(m => m.assignedRole === 'timekeeper');
  if (hasTimekeeper) points += 2;

  const kickedExcess = state.actionLog.filter(l => l.action.includes('Removed'));
  if (kickedExcess.length > 0) points += 2;

  const inRoom = state.team.filter(m => m.inRoom).length;
  if (inRoom <= state.roomCapacity) points += 2;

  return Math.min(12, points);
}

function scoreReversibleCauses(state: GameState): number {
  if (!state.scenario) return 0;
  let points = 0;
  if (state.patient.reversibleCauseIdentified) points += 4;
  if (state.patient.reversibleCauseTreated) points += 4;
  return points;
}

function scorePulseChecks(state: GameState): number {
  const hadOrganizedRhythm = state.actionLog.some(l =>
    l.action.includes('organized rhythm') || l.action.includes('Organized rhythm')
  );

  if (state.pulseChecksDone === 0) {
    if (hadOrganizedRhythm) return 0;
    return 4;
  }

  let points = 0;

  const roscConfirmed = state.actionLog.some(l => l.action.includes('Pulse confirmed'));
  if (roscConfirmed) points += 4;

  const appropriateChecks = state.actionLog.filter(l =>
    l.action.includes('Pulse check:') && !l.details?.includes('Unnecessary')
  ).length;
  if (appropriateChecks >= 1) points += 2;
  if (appropriateChecks >= 2) points += 2;

  return Math.min(8, points);
}

function scoreLeadership(state: GameState): number {
  let points = 4;

  if (state.phase === 'ended') {
    const endEntry = state.actionLog.find(l => l.action.includes('Time of death') || l.action.includes('ROSC'));
    if (endEntry) {
      if (state.scenario?.roscAchievable && ROSC_RHYTHMS.includes(state.patient.rhythm)) {
        points += 4;
      } else if (!state.scenario?.roscAchievable) {
        const tod = state.actionLog.find(l => l.action.includes('Time of death'));
        if (tod && tod.time > 600) points += 2;
      }
    }
  }

  return Math.min(8, points);
}

function scoreRoomControl(state: GameState): number {
  const breakdown = computeRoomControlBreakdown(state);
  const total = breakdown.roleClarity + breakdown.crowdControl +
    breakdown.assignmentFollowThrough + breakdown.ambiguityCorrection + breakdown.delayRecovery;
  return Math.min(10, Math.round(total / 5));
}

export function computeRoomControlBreakdown(state: GameState): DebriefAnalysis['roomControlBreakdown'] {
  const assignedCount = state.team.filter(m => m.assignedRole !== 'none').length;
  const confirmedCount = state.team.filter(m => m.confirmedRole).length;
  const roleClarity = Math.min(10, Math.round((confirmedCount / Math.max(1, assignedCount)) * 10));

  const peakInRoom = state.team.filter(m => m.inRoom).length;
  const kickActions = state.actionLog.filter(l => l.action.includes('Removed')).length;
  const clearActions = state.actionLog.filter(l => l.action.includes('Cleared room')).length;
  const crowdManaged = peakInRoom > state.roomCapacity ? (kickActions + clearActions * 2 > 0 ? 7 : 2) : 10;
  const crowdControl = Math.min(10, crowdManaged);

  const completedOrders = state.pendingOrders.filter(o => o.status === 'completed').length;
  const totalOrders = state.pendingOrders.length;
  const followThrough = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 10) : 8;
  const assignmentFollowThrough = Math.min(10, followThrough);

  const clarifications = state.actionLog.filter(l =>
    l.action.includes('clarif') || l.action.includes('wrong person') || l.action.includes('Confirmed')
  ).length;
  const selfAssignCorrections = state.actionLog.filter(l =>
    l.action.includes('Assigned') && state.team.some(m => m.selfAssignedRole !== null)
  ).length;
  const ambiguityCorrection = Math.min(10, 5 + clarifications + selfAssignCorrections);

  const failedOrders = state.pendingOrders.filter(o => o.status === 'failed' || o.status === 'missed');
  const recoveredFromFail = state.pendingOrders.filter(o => {
    if (o.status !== 'completed') return false;
    return failedOrders.some(f => f.actionType === o.actionType && f.issuedAt < o.issuedAt);
  }).length;
  const delayRecovery = Math.min(10, failedOrders.length === 0 ? 8 : 3 + recoveredFromFail * 3);

  return { roleClarity, crowdControl, assignmentFollowThrough, ambiguityCorrection, delayRecovery };
}

export function generateDebriefAnalysis(state: GameState): DebriefAnalysis {
  const roscAchieved = state.actionLog.some(l => l.action.includes('ROSC'));
  const roscInitiallyAchievable = state.scenario?.roscAchievable ?? false;

  const startProb = roscInitiallyAchievable ? 0.6 : 0.05;
  const endProb = state.patient.roscProbability;

  let playerImpact: 'improved' | 'worsened' | 'neutral' = 'neutral';
  if (endProb > startProb + 0.1) playerImpact = 'improved';
  else if (endProb < startProb - 0.1) playerImpact = 'worsened';

  const mistakes: { description: string; impact: string }[] = [];
  const strengths: { description: string; impact: string }[] = [];

  if (state.compressionFraction < 0.6) {
    mistakes.push({ description: 'Low compression fraction', impact: `Only ${Math.round(state.compressionFraction * 100)}% — target is >60%` });
  } else {
    strengths.push({ description: 'Good compression fraction', impact: `${Math.round(state.compressionFraction * 100)}% — above target` });
  }

  const firstShock = state.actionLog.find(l => l.action.includes('Shock delivered'));
  if (state.scenario && isShockable(state.scenario.initialRhythm)) {
    if (!firstShock || firstShock.time > 120) {
      mistakes.push({ description: 'Late defibrillation', impact: 'First shock significantly delayed — reduces survival by ~10% per minute' });
    } else if (firstShock.time < 60) {
      strengths.push({ description: 'Early defibrillation', impact: `Shock delivered at ${Math.round(firstShock.time)}s — maximizes survival chance` });
    }
  }

  const epiDoses = state.patient.medications.filter(m => m.type === 'epinephrine');
  if (epiDoses.length === 0 && state.clock > 300) {
    mistakes.push({ description: 'No epinephrine given', impact: 'Epi should be given every 3-5 minutes' });
  }

  if (!state.patient.reversibleCauseIdentified && state.clock > 300) {
    mistakes.push({ description: 'Reversible cause not identified', impact: 'H\'s and T\'s should be systematically considered' });
  } else if (state.patient.reversibleCauseIdentified && state.patient.reversibleCauseTreated) {
    strengths.push({ description: 'Reversible cause treated', impact: 'Correct identification and treatment of underlying cause' });
  }

  const failedOrders = state.pendingOrders.filter(o => o.status === 'failed' || o.status === 'missed');
  if (failedOrders.length > 3) {
    mistakes.push({ description: 'Multiple failed orders', impact: `${failedOrders.length} orders failed — consider clearer communication` });
  }

  if (state.closedLoopCount > 0 && state.closedLoopSuccess / state.closedLoopCount > 0.8) {
    strengths.push({ description: 'Strong closed-loop communication', impact: `${Math.round((state.closedLoopSuccess / state.closedLoopCount) * 100)}% confirmation rate` });
  }

  const inRoom = state.team.filter(m => m.inRoom).length;
  if (inRoom > state.roomCapacity) {
    mistakes.push({ description: 'Overcrowded room not managed', impact: `${inRoom} people in room (capacity ${state.roomCapacity}) — increases chaos` });
  }

  let primaryFailureDomain: FailureDomain | null = null;
  if (!roscAchieved && roscInitiallyAchievable) {
    const score = state.score;
    if (score.rhythmCheckTiming + score.defibrillationTiming + score.medicationChoices < 15) {
      primaryFailureDomain = 'algorithm_error';
    } else if (score.teamManagement + (score.roomControl ?? 0) < 10) {
      primaryFailureDomain = 'leadership_failure';
    } else if (score.closedLoopComm < 5) {
      primaryFailureDomain = 'communication_failure';
    } else if (state.compressionFraction < 0.5) {
      primaryFailureDomain = 'compression_interruption';
    } else if (!state.patient.reversibleCauseIdentified) {
      primaryFailureDomain = 'late_recognition';
    } else {
      primaryFailureDomain = 'algorithm_error';
    }
  } else if (!roscAchieved && !roscInitiallyAchievable) {
    primaryFailureDomain = 'futile_scenario';
  }

  const roomControlBreakdown = computeRoomControlBreakdown(state);

  return {
    roscInitiallyAchievable,
    playerImpact,
    roscProbabilityStart: startProb,
    roscProbabilityEnd: endProb,
    topMistakes: mistakes.slice(0, 3),
    topStrengths: strengths.slice(0, 3),
    primaryFailureDomain,
    roomControlBreakdown,
  };
}

export function getGrade(score: number): { letter: string; label: string; color: string } {
  if (score >= 90) return { letter: 'A', label: 'Outstanding', color: 'text-green-400' };
  if (score >= 80) return { letter: 'B', label: 'Proficient', color: 'text-blue-400' };
  if (score >= 70) return { letter: 'C', label: 'Competent', color: 'text-yellow-400' };
  if (score >= 60) return { letter: 'D', label: 'Needs Improvement', color: 'text-orange-400' };
  return { letter: 'F', label: 'Unsatisfactory', color: 'text-red-400' };
}
