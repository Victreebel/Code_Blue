import {
  type GameState, type GameAction, type PatientState, type ActionLogEntry,
  type TeamMember, type StopwatchState, type ScoreBreakdown,
  ROSC_RHYTHMS, SHOCKABLE_RHYTHMS,
} from './types';
import { getHRForRhythm, getBPForRhythm, getSpO2ForRhythm, getEtCO2, isShockable } from './aclsProtocol';
import { getTeamSpeechOnAssignment } from './teamAI';
import { calculateScore } from './scoringEngine';

function uid(): string {
  return Math.random().toString(36).substr(2, 10);
}

function log(state: GameState, action: string, category: ActionLogEntry['category'], details?: string): ActionLogEntry {
  return { id: uid(), time: state.clock, action, category, details };
}

export const initialPatient: PatientState = {
  rhythm: 'asystole',
  hr: 0,
  bp: { systolic: 0, diastolic: 0 },
  spo2: 0,
  etco2: 0,
  hasIV: false,
  hasIO: false,
  hasAdvancedAirway: false,
  cprInProgress: false,
  cprQuality: 0.7,
  lastRhythmCheck: 0,
  lastPulseCheck: -999,
  lastShock: -999,
  shockCount: 0,
  medications: [],
  lastEpinephrine: -999,
  amiodaroneDoses: 0,
  reversibleCause: 'hypoxia',
  reversibleCauseIdentified: false,
  reversibleCauseTreated: false,
};

export const initialScore: ScoreBreakdown = {
  rhythmCheckTiming: 0,
  epinephrineTiming: 0,
  defibrillationTiming: 0,
  medicationChoices: 0,
  pulseChecks: 0,
  closedLoopComm: 0,
  teamManagement: 0,
  reversibleCauses: 0,
  overallLeadership: 0,
  penalties: 0,
  total: 0,
};

export const initialStopwatch: StopwatchState = {
  running: false,
  startTime: 0,
  elapsed: 0,
};

export const initialState: GameState = {
  phase: 'menu',
  scenario: null,
  patient: { ...initialPatient },
  team: [],
  clock: 0,
  running: false,
  actionLog: [],
  score: { ...initialScore },
  stopwatch: { ...initialStopwatch },
  rhythmChecksDone: 0,
  pulseChecksDone: 0,
  cprCycleStart: 0,
  pendingCommands: [],
  roomCapacity: 8,
  closedLoopCount: 0,
  closedLoopSuccess: 0,
};

function updateVitals(patient: PatientState): PatientState {
  const isROSC = ROSC_RHYTHMS.includes(patient.rhythm);
  return {
    ...patient,
    hr: getHRForRhythm(patient.rhythm),
    bp: getBPForRhythm(patient.rhythm),
    spo2: getSpO2ForRhythm(patient.rhythm, patient.hasAdvancedAirway, patient.cprInProgress),
    etco2: getEtCO2(patient.cprInProgress, patient.cprQuality, isROSC),
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_SCENARIO': {
      const s = action.scenario;
      return {
        ...initialState,
        phase: 'briefing',
        scenario: s,
        patient: {
          ...initialPatient,
          rhythm: s.initialRhythm,
          reversibleCause: s.reversibleCause,
        },
        team: s.initialTeam.map(m => ({ ...m })),
        actionLog: [log({ ...initialState, clock: 0 }, `Scenario loaded: ${s.chiefComplaint}`, 'system')],
      };
    }

    case 'BEGIN_CODE': {
      return {
        ...state,
        phase: 'active',
        running: true,
        clock: 0,
        actionLog: [
          ...state.actionLog,
          log({ ...state, clock: 0 }, 'Code Blue initiated — you are the team leader', 'system'),
        ],
      };
    }

    case 'TICK': {
      if (!state.running || state.phase !== 'active') return state;

      const newClock = state.clock + action.delta;
      let newPatient = { ...state.patient };
      const newLog = [...state.actionLog];
      let newTeam = state.team.map(m => {
        const updated = { ...m };
        if (m.speechBubbleUntil > 0 && newClock >= m.speechBubbleUntil) {
          updated.speechBubble = null;
          updated.speechBubbleUntil = 0;
        }
        if (m.busy && m.busyUntil > 0 && newClock >= m.busyUntil) {
          updated.busy = false;
          updated.busyUntil = 0;
        }
        return updated;
      });

      if (state.scenario?.roscAchievable &&
          newClock >= state.scenario.roscTime &&
          newPatient.reversibleCauseTreated &&
          newPatient.cprInProgress &&
          !ROSC_RHYTHMS.includes(newPatient.rhythm)) {
        newPatient.rhythm = 'sinus';
        newPatient = updateVitals(newPatient);
        newLog.push(log({ ...state, clock: newClock }, 'Monitor shows organized rhythm — check pulse!', 'system'));
        const monitorPerson = newTeam.find(m => m.assignedRole === 'monitor_defib' && m.inRoom);
        if (monitorPerson) {
          newTeam = newTeam.map(m => m.id === monitorPerson.id ? {
            ...m,
            speechBubble: "I'm seeing an organized rhythm on the monitor!",
            speechBubbleUntil: newClock + 6,
          } : m);
        }
      }

      newPatient = updateVitals(newPatient);

      const newStopwatch = { ...state.stopwatch };
      if (newStopwatch.running) {
        newStopwatch.elapsed = newClock - newStopwatch.startTime;
      }

      return {
        ...state,
        clock: newClock,
        patient: newPatient,
        team: newTeam,
        stopwatch: newStopwatch,
      };
    }

    case 'ASSIGN_ROLE': {
      const member = state.team.find(m => m.id === action.memberId);
      if (!member || !member.inRoom) return state;

      const speech = getTeamSpeechOnAssignment(member, action.role);
      const willConfirm = member.compliance !== 'resistant' || Math.random() > 0.5;

      const newTeam = state.team.map(m => {
        if (m.id === action.memberId) {
          return {
            ...m,
            assignedRole: action.role,
            confirmedRole: willConfirm,
            selfAssignedRole: null,
            speechBubble: speech.message,
            speechBubbleUntil: state.clock + 4,
          };
        }
        return m;
      });

      return {
        ...state,
        team: newTeam,
        closedLoopCount: state.closedLoopCount + 1,
        closedLoopSuccess: state.closedLoopSuccess + (willConfirm ? 1 : 0),
        actionLog: [
          ...state.actionLog,
          log(state, `Assigned ${member.name} to ${action.role}`, 'command'),
        ],
      };
    }

    case 'CONFIRM_ROLE': {
      const newTeam = state.team.map(m => {
        if (m.id === action.memberId) {
          return {
            ...m,
            confirmedRole: true,
            speechBubble: 'Confirmed!',
            speechBubbleUntil: state.clock + 3,
          };
        }
        return m;
      });
      return {
        ...state,
        team: newTeam,
        closedLoopCount: state.closedLoopCount + 1,
        closedLoopSuccess: state.closedLoopSuccess + 1,
      };
    }

    case 'ORDER_CPR': {
      const compressor = state.team.find(m => m.assignedRole === 'compressor' && m.inRoom && m.confirmedRole);
      if (!compressor && !state.team.some(m => m.inRoom && m.assignedRole === 'none')) {
        return {
          ...state,
          actionLog: [...state.actionLog, log(state, 'No one available for compressions!', 'system')],
        };
      }

      return {
        ...state,
        patient: { ...state.patient, cprInProgress: true, cprQuality: 0.8 },
        cprCycleStart: state.clock,
        actionLog: [...state.actionLog, log(state, 'CPR started — high-quality compressions', 'command')],
      };
    }

    case 'ORDER_STOP_CPR': {
      return {
        ...state,
        patient: { ...state.patient, cprInProgress: false },
        actionLog: [...state.actionLog, log(state, 'CPR paused', 'command')],
      };
    }

    case 'ORDER_RHYTHM_CHECK': {
      const newPatient = {
        ...state.patient,
        cprInProgress: false,
        lastRhythmCheck: state.clock,
      };

      let rhythmDesc: string;
      if (isShockable(newPatient.rhythm)) {
        rhythmDesc = `Rhythm check: ${newPatient.rhythm === 'vfib' ? 'V-Fib' : 'V-Tach'} — SHOCKABLE`;
      } else if (newPatient.rhythm === 'asystole') {
        rhythmDesc = 'Rhythm check: Asystole — Non-shockable';
      } else if (newPatient.rhythm === 'pea') {
        rhythmDesc = 'Rhythm check: PEA — Non-shockable';
      } else {
        const label = newPatient.rhythm === 'sinus' ? 'Normal Sinus Rhythm'
          : newPatient.rhythm === 'sinus_brady' ? 'Sinus Bradycardia' : 'Sinus Tachycardia';
        rhythmDesc = `Rhythm check: ${label} — Organized rhythm, CHECK PULSE`;
      }

      return {
        ...state,
        patient: newPatient,
        rhythmChecksDone: state.rhythmChecksDone + 1,
        actionLog: [...state.actionLog, log(state, rhythmDesc, 'command')],
      };
    }

    case 'ORDER_PULSE_CHECK': {
      const rhythm = state.patient.rhythm;

      const timeSinceLastPulseCheck = state.patient.lastPulseCheck > 0
        ? state.clock - state.patient.lastPulseCheck : Infinity;
      if (timeSinceLastPulseCheck < 10) {
        return {
          ...state,
          actionLog: [...state.actionLog, log(state, 'Pulse check too soon — wait before rechecking', 'system')],
        };
      }

      const isInappropriate = SHOCKABLE_RHYTHMS.includes(rhythm) || rhythm === 'asystole';
      let penalty = 0;
      if (isInappropriate) {
        penalty = -5;
      }

      const hasPulse = ROSC_RHYTHMS.includes(rhythm) &&
        state.scenario?.roscAchievable === true &&
        state.clock >= (state.scenario?.roscTime ?? Infinity) &&
        state.patient.reversibleCauseTreated;

      const newPatient = {
        ...state.patient,
        lastPulseCheck: state.clock,
        cprInProgress: false,
      };

      const pulseChecker = state.team.find(m =>
        m.inRoom && (m.assignedRole === 'compressor' || m.assignedRole === 'monitor_defib' || m.assignedRole !== 'none')
      );

      if (hasPulse) {
        const newTeam = state.team.map(m => {
          if (pulseChecker && m.id === pulseChecker.id) {
            return { ...m, speechBubble: 'We have a pulse! Strong carotid pulse!', speechBubbleUntil: state.clock + 8 };
          }
          return m;
        });
        const finalState = {
          ...state,
          patient: newPatient,
          team: newTeam,
          pulseChecksDone: state.pulseChecksDone + 1,
          phase: 'ended' as const,
          running: false,
          actionLog: [
            ...state.actionLog,
            log(state, 'Pulse check: PULSE PRESENT', 'command'),
            log(state, '*** ROSC ACHIEVED — Pulse confirmed! ***', 'system'),
          ],
        };
        return {
          ...finalState,
          score: calculateScore(finalState),
        };
      }

      let pulseMsg = 'Pulse check: No pulse detected';
      let speechMsg = 'No pulse! Continue CPR!';
      if (SHOCKABLE_RHYTHMS.includes(rhythm)) {
        pulseMsg = `Pulse check: No pulse — ${rhythm === 'vfib' ? 'V-Fib' : 'V-Tach'} on monitor`;
        speechMsg = `No pulse — that's ${rhythm === 'vfib' ? 'V-fib' : 'V-tach'}, we need to shock!`;
      } else if (rhythm === 'asystole') {
        pulseMsg = 'Pulse check: No pulse — asystole on monitor';
        speechMsg = "No pulse, it's flatline. Continue CPR!";
      } else if (rhythm === 'pea') {
        pulseMsg = 'Pulse check: No pulse — PEA (organized rhythm without pulse)';
        speechMsg = 'No pulse despite organized rhythm — PEA! Continue CPR!';
      } else if (ROSC_RHYTHMS.includes(rhythm)) {
        pulseMsg = 'Pulse check: No pulse — organized rhythm but no perfusion (PEA)';
        speechMsg = 'No pulse! Organized rhythm but no perfusion. Continue CPR!';
      }

      const newTeam = state.team.map(m => {
        if (pulseChecker && m.id === pulseChecker.id) {
          return { ...m, speechBubble: speechMsg, speechBubbleUntil: state.clock + 5 };
        }
        return m;
      });

      const details = isInappropriate
        ? 'Unnecessary pulse check on non-perfusing rhythm — resume CPR immediately'
        : 'Resume CPR immediately';

      return {
        ...state,
        patient: newPatient,
        team: newTeam,
        pulseChecksDone: state.pulseChecksDone + 1,
        score: { ...state.score, penalties: state.score.penalties + penalty },
        actionLog: [...state.actionLog, log(state, pulseMsg, 'command', details)],
      };
    }

    case 'ORDER_SHOCK': {
      if (!isShockable(state.patient.rhythm)) {
        return {
          ...state,
          actionLog: [...state.actionLog, log(state, 'Cannot shock — non-shockable rhythm!', 'system')],
          score: { ...state.score, penalties: state.score.penalties - 10 },
        };
      }

      const newPatient = {
        ...state.patient,
        lastShock: state.clock,
        shockCount: state.patient.shockCount + 1,
        cprInProgress: false,
      };

      return {
        ...state,
        patient: newPatient,
        actionLog: [...state.actionLog, log(state, `Shock delivered (${newPatient.shockCount}) — 200J biphasic`, 'command', 'Resume CPR immediately')],
      };
    }

    case 'ORDER_MEDICATION': {
      if (!state.patient.hasIV && !state.patient.hasIO) {
        return {
          ...state,
          actionLog: [...state.actionLog, log(state, 'Cannot give medication — no IV/IO access!', 'system')],
        };
      }

      const medAdmin = state.team.find(m => (m.assignedRole === 'medication' || m.assignedRole === 'iv_access') && m.inRoom);
      const medRecord = { type: action.medication, dose: action.dose, timeGiven: state.clock };
      const newPatient = {
        ...state.patient,
        medications: [...state.patient.medications, medRecord],
      };

      if (action.medication === 'epinephrine') {
        newPatient.lastEpinephrine = state.clock;
      }
      if (action.medication === 'amiodarone') {
        newPatient.amiodaroneDoses += 1;
      }

      const newTeam = state.team.map(m => {
        if (medAdmin && m.id === medAdmin.id) {
          return {
            ...m,
            speechBubble: `Pushing ${action.medication} ${action.dose} now.`,
            speechBubbleUntil: state.clock + 3,
            busy: true,
            busyUntil: state.clock + 5,
          };
        }
        return m;
      });

      return {
        ...state,
        patient: newPatient,
        team: newTeam,
        actionLog: [...state.actionLog, log(state, `${action.medication} ${action.dose} administered`, 'command')],
      };
    }

    case 'ORDER_AIRWAY': {
      const airwayPerson = state.team.find(m => m.assignedRole === 'airway' && m.inRoom);
      const newTeam = state.team.map(m => {
        if (airwayPerson && m.id === airwayPerson.id) {
          return {
            ...m,
            speechBubble: action.advanced ? 'Attempting intubation...' : 'Bagging the patient.',
            speechBubbleUntil: state.clock + 5,
            busy: true,
            busyUntil: state.clock + (action.advanced ? 15 : 3),
          };
        }
        return m;
      });

      return {
        ...state,
        patient: {
          ...state.patient,
          hasAdvancedAirway: action.advanced ? true : state.patient.hasAdvancedAirway,
        },
        team: newTeam,
        actionLog: [...state.actionLog, log(state, action.advanced ? 'Advanced airway ordered' : 'BVM ventilation ordered', 'command')],
      };
    }

    case 'ORDER_IV_ACCESS': {
      const ivPerson = state.team.find(m => (m.assignedRole === 'iv_access' || m.assignedRole === 'medication') && m.inRoom);
      const newTeam = state.team.map(m => {
        if (ivPerson && m.id === ivPerson.id) {
          return {
            ...m,
            speechBubble: action.io ? 'Placing IO...' : 'Starting IV...',
            speechBubbleUntil: state.clock + 6,
            busy: true,
            busyUntil: state.clock + (action.io ? 8 : 12),
          };
        }
        return m;
      });

      return {
        ...state,
        patient: {
          ...state.patient,
          hasIV: action.io ? state.patient.hasIV : true,
          hasIO: action.io ? true : state.patient.hasIO,
        },
        team: newTeam,
        actionLog: [...state.actionLog, log(state, action.io ? 'IO access ordered' : 'IV access ordered', 'command')],
      };
    }

    case 'IDENTIFY_CAUSE': {
      const correct = state.scenario?.reversibleCause === action.cause;
      return {
        ...state,
        patient: {
          ...state.patient,
          reversibleCauseIdentified: correct,
        },
        actionLog: [
          ...state.actionLog,
          log(state, `Identified reversible cause: ${action.cause}${correct ? ' (CORRECT)' : ''}`, 'command'),
        ],
      };
    }

    case 'TREAT_CAUSE': {
      if (!state.patient.reversibleCauseIdentified) {
        return {
          ...state,
          actionLog: [...state.actionLog, log(state, 'Must identify reversible cause before treating', 'system')],
        };
      }
      return {
        ...state,
        patient: { ...state.patient, reversibleCauseTreated: true },
        actionLog: [...state.actionLog, log(state, 'Treatment for reversible cause initiated', 'command')],
      };
    }

    case 'KICK_MEMBER': {
      const member = state.team.find(m => m.id === action.memberId);
      if (!member) return state;
      const newTeam = state.team.map(m => {
        if (m.id === action.memberId) {
          return { ...m, inRoom: false, assignedRole: 'none' as const, confirmedRole: false };
        }
        return m;
      });
      return {
        ...state,
        team: newTeam,
        actionLog: [...state.actionLog, log(state, `Removed ${member.name} from the room`, 'command')],
      };
    }

    case 'CALL_TIME_OF_DEATH': {
      const penalty = state.scenario?.roscAchievable ? -30 : 0;
      const finalScore = calculateScore({
        ...state,
        phase: 'ended',
        score: { ...state.score, penalties: state.score.penalties + penalty },
      });

      return {
        ...state,
        phase: 'ended',
        running: false,
        score: { ...finalScore, penalties: finalScore.penalties + penalty },
        actionLog: [
          ...state.actionLog,
          log(state, `Time of death called at ${formatTime(state.clock)}`, 'system',
            state.scenario?.roscAchievable ? 'ROSC was achievable — premature termination' : 'Appropriate decision'),
        ],
      };
    }

    case 'TOGGLE_STOPWATCH': {
      if (state.stopwatch.running) {
        return {
          ...state,
          stopwatch: { ...state.stopwatch, running: false },
        };
      }
      return {
        ...state,
        stopwatch: { ...state.stopwatch, running: true, startTime: state.clock },
      };
    }

    case 'RESET_STOPWATCH': {
      return {
        ...state,
        stopwatch: { running: false, startTime: 0, elapsed: 0 },
      };
    }

    case 'PAUSE_GAME': {
      return { ...state, running: false, phase: 'paused' };
    }

    case 'RESUME_GAME': {
      return { ...state, running: true, phase: 'active' };
    }

    case 'END_GAME': {
      const finalScore = calculateScore({ ...state, phase: 'ended' });
      return {
        ...state,
        phase: 'ended',
        running: false,
        score: finalScore,
        actionLog: [...state.actionLog, log(state, `Code ended: ${action.reason}`, 'system')],
      };
    }

    case 'VIEW_DEBRIEF': {
      return { ...state, phase: 'debrief' };
    }

    case 'FIRE_EVENT': {
      return {
        ...state,
        actionLog: [...state.actionLog, log(state, `⚠ ${action.event.type.replace(/_/g, ' ').toUpperCase()}`, 'complication')],
      };
    }

    case 'TEAM_SPEECH': {
      const newTeam = state.team.map(m => {
        if (m.id === action.memberId) {
          return {
            ...m,
            speechBubble: action.message,
            speechBubbleUntil: state.clock + action.duration,
          };
        }
        return m;
      });
      return { ...state, team: newTeam };
    }

    case 'CLEAR_SPEECH': {
      const newTeam = state.team.map(m => {
        if (m.id === action.memberId) {
          return { ...m, speechBubble: null, speechBubbleUntil: 0 };
        }
        return m;
      });
      return { ...state, team: newTeam };
    }

    case 'MEMBER_SELF_ASSIGN': {
      const newTeam = state.team.map(m => {
        if (m.id === action.memberId) {
          return {
            ...m,
            assignedRole: action.role,
            confirmedRole: false,
            selfAssignedRole: action.role,
          };
        }
        return m;
      });
      return {
        ...state,
        team: newTeam,
        actionLog: [...state.actionLog, log(state, `${state.team.find(m => m.id === action.memberId)?.name} self-assigned to ${action.role}`, 'team')],
      };
    }

    case 'NEW_MEMBER_ARRIVES': {
      return {
        ...state,
        team: [...state.team, action.member],
        actionLog: [...state.actionLog, log(state, `${action.member.name} (${action.member.staffType}) arrived in the room`, 'event')],
      };
    }

    case 'COMPLICATION_IV_LOST': {
      return {
        ...state,
        patient: { ...state.patient, hasIV: false, hasIO: false },
        actionLog: [...state.actionLog, log(state, 'Vascular access LOST — IV infiltrated', 'complication')],
      };
    }

    case 'COMPLICATION_EQUIPMENT_FAILURE': {
      return {
        ...state,
        patient: { ...state.patient, lastShock: state.clock + 15 },
        actionLog: [...state.actionLog, log(state, 'Defibrillator malfunction — charging delayed 15s', 'complication')],
      };
    }

    case 'COMPLICATION_STAFF_LEAVES': {
      const leavingMember = state.team.find(m => m.id === action.memberId);
      const newTeam = state.team.map(m => {
        if (m.id === action.memberId) {
          return { ...m, inRoom: false, assignedRole: 'none' as const, confirmedRole: false };
        }
        return m;
      });
      return {
        ...state,
        team: newTeam,
        actionLog: [...state.actionLog, log(state, `${leavingMember?.name ?? 'A team member'} left the room`, 'complication')],
      };
    }

    case 'COMPLICATION_RHYTHM_CHANGE': {
      const newPatient = { ...state.patient, rhythm: action.newRhythm };
      return {
        ...state,
        patient: updateVitals(newPatient),
        actionLog: [...state.actionLog, log(state, `Rhythm changed to ${action.newRhythm.replace(/_/g, ' ')}`, 'complication')],
      };
    }

    case 'COMPLICATION_CPR_FATIGUE': {
      return {
        ...state,
        patient: { ...state.patient, cprQuality: Math.max(0.3, state.patient.cprQuality - 0.2) },
        actionLog: [...state.actionLog, log(state, 'Compressor fatigued — CPR quality declining', 'complication')],
      };
    }

    default:
      return state;
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
