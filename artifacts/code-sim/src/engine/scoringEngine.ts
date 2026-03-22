import { type GameState, type ScoreBreakdown, ROSC_RHYTHMS } from './types';
import { EPI_MIN_INTERVAL, EPI_MAX_INTERVAL, CPR_CYCLE_DURATION, isShockable } from './aclsProtocol';

export function calculateScore(state: GameState): ScoreBreakdown {
  const score: ScoreBreakdown = {
    rhythmCheckTiming: 0,
    epinephrineTiming: 0,
    defibrillationTiming: 0,
    medicationChoices: 0,
    closedLoopComm: 0,
    teamManagement: 0,
    reversibleCauses: 0,
    overallLeadership: 0,
    penalties: 0,
    total: 0,
  };

  if (!state.scenario) return score;

  score.rhythmCheckTiming = scoreRhythmChecks(state);
  score.epinephrineTiming = scoreEpinephrine(state);
  score.defibrillationTiming = scoreDefibrillation(state);
  score.medicationChoices = scoreMedications(state);
  score.closedLoopComm = scoreClosedLoop(state);
  score.teamManagement = scoreTeamManagement(state);
  score.reversibleCauses = scoreReversibleCauses(state);
  score.overallLeadership = scoreLeadership(state);

  score.total = Math.max(0, Math.min(100,
    score.rhythmCheckTiming +
    score.epinephrineTiming +
    score.defibrillationTiming +
    score.medicationChoices +
    score.closedLoopComm +
    score.teamManagement +
    score.reversibleCauses +
    score.overallLeadership +
    score.penalties
  ));

  return score;
}

function scoreRhythmChecks(state: GameState): number {
  if (state.rhythmChecksDone === 0) return 0;
  const expectedChecks = Math.floor(state.clock / CPR_CYCLE_DURATION);
  if (expectedChecks === 0) return 15;
  const ratio = Math.min(state.rhythmChecksDone / expectedChecks, 1);
  return Math.floor(ratio * 15);
}

function scoreEpinephrine(state: GameState): number {
  const epiDoses = state.patient.medications.filter(m => m.type === 'epinephrine');
  if (epiDoses.length === 0) {
    if (state.clock > EPI_MAX_INTERVAL) return 0;
    return 10;
  }

  let points = 5;
  for (let i = 1; i < epiDoses.length; i++) {
    const interval = epiDoses[i].timeGiven - epiDoses[i - 1].timeGiven;
    if (interval >= EPI_MIN_INTERVAL && interval <= EPI_MAX_INTERVAL) {
      points += 3;
    } else if (interval >= EPI_MIN_INTERVAL - 30 && interval <= EPI_MAX_INTERVAL + 60) {
      points += 1;
    }
  }

  return Math.min(15, points);
}

function scoreDefibrillation(state: GameState): number {
  if (!state.scenario) return 0;
  const initialShockable = isShockable(state.scenario.initialRhythm);
  if (!initialShockable) return 10;

  if (state.patient.shockCount === 0) return 0;

  const log = state.actionLog;
  const firstShock = log.find(l => l.action.includes('Shock delivered'));
  if (!firstShock) return 0;

  if (firstShock.time < 30) return 15;
  if (firstShock.time < 60) return 10;
  if (firstShock.time < 120) return 5;
  return 2;
}

function scoreMedications(state: GameState): number {
  const meds = state.patient.medications;
  if (meds.length === 0) return 0;

  let points = 0;
  const hasEpi = meds.some(m => m.type === 'epinephrine');
  if (hasEpi) points += 5;

  if (state.scenario && isShockable(state.scenario.initialRhythm)) {
    const hasAmio = meds.some(m => m.type === 'amiodarone');
    if (hasAmio && state.patient.shockCount >= 1) points += 5;
  }

  return Math.min(10, points);
}

function scoreClosedLoop(state: GameState): number {
  if (state.closedLoopCount === 0) return 5;
  const ratio = state.closedLoopSuccess / state.closedLoopCount;
  return Math.floor(ratio * 15);
}

function scoreTeamManagement(state: GameState): number {
  let points = 0;
  const assignedRoles = state.team.filter(m => m.assignedRole !== 'none');
  if (assignedRoles.length >= 3) points += 5;
  if (assignedRoles.length >= 5) points += 3;

  const hasTimekeeper = state.team.some(m => m.assignedRole === 'timekeeper');
  if (hasTimekeeper) points += 2;

  const kickedExcess = state.actionLog.filter(l => l.action.includes('Removed'));
  if (kickedExcess.length > 0) points += 2;

  const inRoom = state.team.filter(m => m.inRoom).length;
  if (inRoom <= state.roomCapacity) points += 3;

  return Math.min(15, points);
}

function scoreReversibleCauses(state: GameState): number {
  if (!state.scenario) return 0;
  let points = 0;
  if (state.patient.reversibleCauseIdentified) points += 5;
  if (state.patient.reversibleCauseTreated) points += 5;
  return points;
}

function scoreLeadership(state: GameState): number {
  let points = 5;

  if (state.phase === 'ended') {
    const endEntry = state.actionLog.find(l => l.action.includes('Time of death') || l.action.includes('ROSC'));
    if (endEntry) {
      if (state.scenario?.roscAchievable && ROSC_RHYTHMS.includes(state.patient.rhythm)) {
        points += 5;
      } else if (!state.scenario?.roscAchievable) {
        const tod = state.actionLog.find(l => l.action.includes('Time of death'));
        if (tod && tod.time > 600) points += 3;
      }
    }
  }

  return Math.min(10, points);
}

export function getGrade(score: number): { letter: string; label: string; color: string } {
  if (score >= 90) return { letter: 'A', label: 'Outstanding', color: 'text-green-400' };
  if (score >= 80) return { letter: 'B', label: 'Proficient', color: 'text-blue-400' };
  if (score >= 70) return { letter: 'C', label: 'Competent', color: 'text-yellow-400' };
  if (score >= 60) return { letter: 'D', label: 'Needs Improvement', color: 'text-orange-400' };
  return { letter: 'F', label: 'Unsatisfactory', color: 'text-red-400' };
}
