import { useReducer, useCallback, useRef, useEffect } from 'react';
import { gameReducer, initialState } from './gameReducer';
import { type GameAction, type Scenario, type TeamRole, type MedicationType, type ReversibleCause, type ComplicationType, type Rhythm, type OrderStatus, SHOCKABLE_RHYTHMS, NON_SHOCKABLE_RHYTHMS } from './types';
import { generateScenario, type SeedScenarioId } from './scenarioGenerator';
import { processSelfAssignments, generateAmbientSpeech, handleComplication, generateSpontaneousBehaviors } from './teamAI';
import { generateNewTeamMember } from './scenarioGenerator';

const TICK_RATE = 100;
const GAME_SPEED = 1;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function useGameEngine() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);
  const eventCheckRef = useRef<number>(0);
  const aiCheckRef = useRef<number>(0);
  const firedEventsRef = useRef<Set<number>>(new Set());
  const prevPatientRef = useRef<typeof state.patient | null>(null);

  useEffect(() => {
    if (state.phase !== 'active') {
      prevPatientRef.current = null;
      return;
    }
    const prev = prevPatientRef.current;
    const cur = state.patient;
    const t = formatTime(state.clock);
    if (!prev) {
      prevPatientRef.current = cur;
      return;
    }

    if (prev.hasIV !== cur.hasIV) {
      console.log(`%c[${t}] hasIV: ${prev.hasIV} → ${cur.hasIV}`, 'color: #22d3ee; font-weight: bold');
    }
    if (prev.hasIO !== cur.hasIO) {
      console.log(`%c[${t}] hasIO: ${prev.hasIO} → ${cur.hasIO}`, 'color: #22d3ee; font-weight: bold');
    }
    if (prev.rhythm !== cur.rhythm) {
      console.log(`%c[${t}] rhythm: ${prev.rhythm} → ${cur.rhythm}`, 'color: #f59e0b; font-weight: bold');
    }
    if (prev.cprInProgress !== cur.cprInProgress) {
      console.log(`%c[${t}] cprInProgress: ${prev.cprInProgress} → ${cur.cprInProgress}`, 'color: #a78bfa; font-weight: bold');
    }
    if (prev.hasAdvancedAirway !== cur.hasAdvancedAirway) {
      console.log(`%c[${t}] hasAdvancedAirway: ${prev.hasAdvancedAirway} → ${cur.hasAdvancedAirway}`, 'color: #34d399; font-weight: bold');
    }
    if (prev.hasPulse !== cur.hasPulse) {
      console.log(`%c[${t}] hasPulse: ${prev.hasPulse} → ${cur.hasPulse}`, 'color: #f43f5e; font-weight: bold');
    }
    if (prev.rolesConfirmed !== cur.rolesConfirmed) {
      console.log(`%c[${t}] rolesConfirmed: ${prev.rolesConfirmed} → ${cur.rolesConfirmed}`, 'color: #94a3b8');
    }
    if (prev.defibCharged !== cur.defibCharged) {
      console.log(`%c[${t}] defibCharged: ${prev.defibCharged} → ${cur.defibCharged}`, 'color: #fbbf24; font-weight: bold');
    }
    if (prev.medications.length !== cur.medications.length) {
      const newMed = cur.medications[cur.medications.length - 1];
      console.log(`%c[${t}] medication applied: ${newMed.type} ${newMed.dose}`, 'color: #fb923c; font-weight: bold');
    }
    if (Math.abs(prev.hr - cur.hr) >= 5) {
      console.log(`[${t}] hr: ${prev.hr} → ${cur.hr}`);
    }
    if (Math.abs(prev.bp.systolic - cur.bp.systolic) >= 5) {
      console.log(`[${t}] bp: ${prev.bp.systolic}/${prev.bp.diastolic} → ${cur.bp.systolic}/${cur.bp.diastolic}`);
    }
    if (Math.abs(prev.spo2 - cur.spo2) >= 2) {
      console.log(`[${t}] spo2: ${prev.spo2} → ${cur.spo2}`);
    }
    if (Math.abs(prev.etco2 - cur.etco2) >= 3) {
      console.log(`[${t}] etco2: ${prev.etco2} → ${cur.etco2}`);
    }
    if (prev.identifiedCause !== cur.identifiedCause) {
      console.log(`%c[${t}] identifiedCause: ${prev.identifiedCause ?? 'none'} → ${cur.identifiedCause ?? 'none'}`, 'color: #e879f9; font-weight: bold');
    }
    if (prev.treatedCause !== cur.treatedCause) {
      console.log(`%c[${t}] treatedCause: ${prev.treatedCause} → ${cur.treatedCause}`, 'color: #e879f9; font-weight: bold');
    }

    prevPatientRef.current = cur;
  }, [state.patient, state.phase, state.clock]);

  const startGame = useCallback((difficulty: 'easy' | 'medium' | 'hard' = 'medium', seedId?: SeedScenarioId) => {
    const scenario = generateScenario(difficulty, seedId);
    firedEventsRef.current = new Set();
    dispatch({ type: 'START_SCENARIO', scenario });
  }, []);

  const beginCode = useCallback(() => {
    lastTickRef.current = Date.now();
    dispatch({ type: 'BEGIN_CODE' });
  }, []);

  useEffect(() => {
    if (state.running && state.phase === 'active') {
      lastTickRef.current = Date.now();
      tickRef.current = setInterval(() => {
        const now = Date.now();
        const delta = ((now - lastTickRef.current) / 1000) * GAME_SPEED;
        lastTickRef.current = now;
        dispatch({ type: 'TICK', delta });
      }, TICK_RATE);
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state.running, state.phase]);

  useEffect(() => {
    if (!state.running || state.phase !== 'active' || !state.scenario) return;

    const now = state.clock;

    if (now - eventCheckRef.current > 1) {
      eventCheckRef.current = now;

      for (let i = 0; i < state.scenario.scheduledEvents.length; i++) {
        const evt = state.scenario.scheduledEvents[i];
        if (!firedEventsRef.current.has(i) && now >= evt.time) {
          firedEventsRef.current.add(i);
          dispatch({ type: 'FIRE_EVENT', event: evt });

          const result = handleComplication(evt.type, state);
          for (const msg of result.messages) {
            if (msg.memberId) {
              dispatch({ type: 'TEAM_SPEECH', memberId: msg.memberId, message: msg.message, duration: 6 });
            }
          }
          if (result.newMembers) {
            for (const m of result.newMembers) {
              dispatch({ type: 'NEW_MEMBER_ARRIVES', member: m });
            }
          }

          if (evt.type === 'iv_lost') {
            dispatch({ type: 'COMPLICATION_IV_LOST' });
          } else if (evt.type === 'equipment_failure') {
            dispatch({ type: 'COMPLICATION_EQUIPMENT_FAILURE' });
          } else if (evt.type === 'staff_leaves') {
            const leaver = state.team.find(m =>
              m.inRoom && m.assignedRole === 'none' && m.staffType !== 'nurse'
            );
            if (leaver) {
              dispatch({ type: 'COMPLICATION_STAFF_LEAVES', memberId: leaver.id });
            }
          } else if (evt.type === 'rhythm_change') {
            const allRhythms: Rhythm[] = [...SHOCKABLE_RHYTHMS, ...NON_SHOCKABLE_RHYTHMS];
            const otherRhythms = allRhythms.filter(r => r !== state.patient.rhythm);
            const newRhythm = otherRhythms[Math.floor(Math.random() * otherRhythms.length)];
            dispatch({ type: 'COMPLICATION_RHYTHM_CHANGE', newRhythm });
          } else if (evt.type === 'cpr_fatigue') {
            dispatch({ type: 'COMPLICATION_CPR_FATIGUE' });
          }
        }
      }
    }

    if (now - aiCheckRef.current > 3) {
      aiCheckRef.current = now;

      const selfAssigns = processSelfAssignments(state);
      for (const sa of selfAssigns) {
        dispatch({ type: 'MEMBER_SELF_ASSIGN', memberId: sa.memberId, role: sa.role });
        dispatch({ type: 'TEAM_SPEECH', memberId: sa.memberId, message: sa.message, duration: 5 });
      }

      const ambient = generateAmbientSpeech(state);
      for (const sp of ambient) {
        dispatch({ type: 'TEAM_SPEECH', memberId: sp.memberId, message: sp.message, duration: 4 });
      }

      const spontaneous = generateSpontaneousBehaviors(state);
      for (const evt of spontaneous) {
        dispatch({ type: 'TEAM_SPEECH', memberId: evt.memberId, message: evt.message, duration: 5 });
        if (evt.eventType !== 'initiative') {
          const member = state.team.find(m => m.id === evt.memberId);
          const name = member?.name ?? 'Staff';
          const logMsg = evt.eventType === 'clarification' ? `${name} asks for clarification`
            : evt.eventType === 'distraction' ? `${name} is distracted`
            : evt.eventType === 'wrong_task' ? `${name} performed wrong task`
            : evt.eventType === 'duplicate' ? `${name} duplicated a task`
            : `${name}: behavioral event`;
          dispatch({ type: 'FIRE_EVENT', event: { time: state.clock, type: 'cpr_fatigue', fired: true } });
        }
      }
    }
  }, [state.clock, state.running, state.phase, state.scenario]);

  const actions = {
    startGame,
    beginCode,
    assignRole: (memberId: string, role: TeamRole) => dispatch({ type: 'ASSIGN_ROLE', memberId, role }),
    confirmRole: (memberId: string) => dispatch({ type: 'CONFIRM_ROLE', memberId }),
    orderCPR: () => dispatch({ type: 'ORDER_CPR' }),
    orderStopCPR: () => dispatch({ type: 'ORDER_STOP_CPR' }),
    orderRhythmCheck: () => dispatch({ type: 'ORDER_RHYTHM_CHECK' }),
    orderPulseCheck: () => dispatch({ type: 'ORDER_PULSE_CHECK' }),
    orderShock: () => dispatch({ type: 'ORDER_SHOCK' }),
    orderMedication: (med: MedicationType, dose: string) => dispatch({ type: 'ORDER_MEDICATION', medication: med, dose }),
    orderAirway: (advanced: boolean) => dispatch({ type: 'ORDER_AIRWAY', advanced }),
    orderIVAccess: (io: boolean) => dispatch({ type: 'ORDER_IV_ACCESS', io }),
    identifyCause: (cause: ReversibleCause) => dispatch({ type: 'IDENTIFY_CAUSE', cause }),
    treatCause: () => dispatch({ type: 'TREAT_CAUSE' }),
    kickMember: (memberId: string) => dispatch({ type: 'KICK_MEMBER', memberId }),
    chargeDefib: () => dispatch({ type: 'CHARGE_DEFIB' }),
    requestCompressorSwitch: () => dispatch({ type: 'REQUEST_COMPRESSOR_SWITCH' }),
    announceCycle: () => dispatch({ type: 'ANNOUNCE_CYCLE' }),
    clearRoom: () => dispatch({ type: 'CLEAR_ROOM' }),
    callTimeOfDeath: () => dispatch({ type: 'CALL_TIME_OF_DEATH' }),
    toggleStopwatch: () => dispatch({ type: 'TOGGLE_STOPWATCH' }),
    resetStopwatch: () => dispatch({ type: 'RESET_STOPWATCH' }),
    pauseGame: () => dispatch({ type: 'PAUSE_GAME' }),
    resumeGame: () => dispatch({ type: 'RESUME_GAME' }),
    viewDebrief: () => dispatch({ type: 'VIEW_DEBRIEF' }),
  };

  return { state, actions };
}
