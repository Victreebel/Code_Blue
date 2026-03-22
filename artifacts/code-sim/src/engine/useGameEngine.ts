import { useReducer, useCallback, useRef, useEffect } from 'react';
import { gameReducer, initialState } from './gameReducer';
import { type GameAction, type Scenario, type TeamRole, type MedicationType, type ReversibleCause, type ComplicationType, type Rhythm, SHOCKABLE_RHYTHMS, NON_SHOCKABLE_RHYTHMS } from './types';
import { generateScenario } from './scenarioGenerator';
import { processSelfAssignments, generateAmbientSpeech, handleComplication } from './teamAI';
import { generateNewTeamMember } from './scenarioGenerator';

const TICK_RATE = 100;
const GAME_SPEED = 1;

export function useGameEngine() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);
  const eventCheckRef = useRef<number>(0);
  const aiCheckRef = useRef<number>(0);
  const firedEventsRef = useRef<Set<number>>(new Set());

  const startGame = useCallback((difficulty: 'easy' | 'medium' | 'hard' = 'medium') => {
    const scenario = generateScenario(difficulty);
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
    orderShock: () => dispatch({ type: 'ORDER_SHOCK' }),
    orderMedication: (med: MedicationType, dose: string) => dispatch({ type: 'ORDER_MEDICATION', medication: med, dose }),
    orderAirway: (advanced: boolean) => dispatch({ type: 'ORDER_AIRWAY', advanced }),
    orderIVAccess: (io: boolean) => dispatch({ type: 'ORDER_IV_ACCESS', io }),
    identifyCause: (cause: ReversibleCause) => dispatch({ type: 'IDENTIFY_CAUSE', cause }),
    treatCause: () => dispatch({ type: 'TREAT_CAUSE' }),
    kickMember: (memberId: string) => dispatch({ type: 'KICK_MEMBER', memberId }),
    callTimeOfDeath: () => dispatch({ type: 'CALL_TIME_OF_DEATH' }),
    toggleStopwatch: () => dispatch({ type: 'TOGGLE_STOPWATCH' }),
    resetStopwatch: () => dispatch({ type: 'RESET_STOPWATCH' }),
    pauseGame: () => dispatch({ type: 'PAUSE_GAME' }),
    resumeGame: () => dispatch({ type: 'RESUME_GAME' }),
    viewDebrief: () => dispatch({ type: 'VIEW_DEBRIEF' }),
  };

  return { state, actions };
}
