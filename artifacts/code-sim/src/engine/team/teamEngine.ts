import type { TeamMemberRuntime, TeamState } from '../types/team';
import type { ScenarioInput, ScenarioMember } from '../types/scenario';
import type { ReplayState } from '../types/replay';
import type { TeamRole } from '../types/core';
import { append } from '../replay/replayEngine';
import { STAFF_ARCHETYPES } from './archetypes';
import { draw, drawChoice, type RngState } from '../rng';

function memberFrom(scenarioMember: ScenarioMember): TeamMemberRuntime {
  return {
    id: scenarioMember.id,
    name: scenarioMember.name,
    staffType: scenarioMember.staffType,
    archetypeId: scenarioMember.archetypeId,
    competence: scenarioMember.competence,
    compliance: scenarioMember.compliance,
    behavior: scenarioMember.behavior,
    isLeader: scenarioMember.isLeader,
    assignedRole: scenarioMember.initialRole,
    confirmedRole: scenarioMember.isLeader,
    inRoom: true,
    busyUntil: 0,
    fatigueLevel: 0,
    speech: null,
    currentOrderId: null,
  };
}

export function initTeamState(input: ScenarioInput): TeamState {
  return { members: input.team.map(memberFrom) };
}

export function findMember(team: TeamState, id: string): TeamMemberRuntime | null {
  return team.members.find(m => m.id === id) ?? null;
}

export function findByRole(team: TeamState, role: TeamRole): TeamMemberRuntime | null {
  return team.members.find(m => m.assignedRole === role) ?? null;
}

export function assignRole(
  team: TeamState,
  replay: ReplayState,
  memberId: string,
  role: TeamRole,
  clock: number,
): { team: TeamState; replay: ReplayState } {
  const m = findMember(team, memberId);
  if (!m) return { team, replay };
  const previousRole = m.assignedRole;
  const next: TeamState = {
    members: team.members.map(x =>
      x.id === memberId
        ? { ...x, assignedRole: role, confirmedRole: false }
        : x,
    ),
  };
  const nextReplay = append(replay, clock, 'team', 'team.role.assigned', {
    memberId,
    memberName: m.name,
    previousRole,
    newRole: role,
  });
  return { team: next, replay: nextReplay };
}

export function confirmRole(
  team: TeamState,
  replay: ReplayState,
  memberId: string,
  clock: number,
): { team: TeamState; replay: ReplayState } {
  const m = findMember(team, memberId);
  if (!m || m.confirmedRole) return { team, replay };
  const next: TeamState = {
    members: team.members.map(x => (x.id === memberId ? { ...x, confirmedRole: true } : x)),
  };
  const nextReplay = append(replay, clock, 'team', 'team.role.confirmed', {
    memberId,
    memberName: m.name,
    role: m.assignedRole,
  });
  return { team: next, replay: nextReplay };
}

export function setBusy(
  team: TeamState,
  memberId: string,
  busyUntil: number,
  orderId: string | null,
): TeamState {
  return {
    members: team.members.map(x =>
      x.id === memberId ? { ...x, busyUntil, currentOrderId: orderId } : x,
    ),
  };
}

export function applyFatigue(team: TeamState, memberId: string, deltaSeconds: number): TeamState {
  return {
    members: team.members.map(x => {
      if (x.id !== memberId) return x;
      const next = Math.min(1, x.fatigueLevel + deltaSeconds / 120);
      return { ...x, fatigueLevel: next };
    }),
  };
}

export function clearFatigue(team: TeamState, memberId: string): TeamState {
  return {
    members: team.members.map(x => (x.id === memberId ? { ...x, fatigueLevel: 0 } : x)),
  };
}

export function setSpeech(team: TeamState, memberId: string, text: string, until: number): TeamState {
  return {
    members: team.members.map(x => (x.id === memberId ? { ...x, speech: { text, until } } : x)),
  };
}

function speechDuration(text: string): number {
  return text.length > 40 ? 6 : 5;
}

export interface AckSpeechInput {
  team: TeamState;
  rng: RngState;
  memberId: string;
  clock: number;
}

export interface AckSpeechOutput {
  team: TeamState;
  rng: RngState;
}

export function applyOrderAcknowledgment(input: AckSpeechInput): AckSpeechOutput {
  const { memberId, clock } = input;
  let { team, rng } = input;
  const m = findMember(team, memberId);
  if (!m || m.speech) return { team, rng };
  const arche = STAFF_ARCHETYPES[m.archetypeId];
  const phrases = arche.acknowledgmentPhrases.length > 0
    ? arche.acknowledgmentPhrases
    : ['Got it.'];
  const [phrase, r1] = drawChoice(rng, phrases);
  rng = r1;
  const dur = speechDuration(phrase);
  team = setSpeech(team, memberId, phrase, clock + dur);
  return { team, rng };
}

export interface TeamTickOutput {
  team: TeamState;
  replay: ReplayState;
  rng: RngState;
}

const SPONTANEOUS_RATE_BASE = 0.006;

export function stepTeam(
  team: TeamState,
  replay: ReplayState,
  rng: RngState,
  clock: number,
  cprActive: boolean,
  currentCompressorId: string | null,
): TeamTickOutput {
  let nextTeam = team;
  let nextReplay = replay;
  let nextRng = rng;

  for (const m of nextTeam.members) {
    if (m.speech && m.speech.until <= clock) {
      nextTeam = {
        members: nextTeam.members.map(x => (x.id === m.id ? { ...x, speech: null } : x)),
      };
    }
  }

  if (cprActive && currentCompressorId) {
    nextTeam = applyFatigue(nextTeam, currentCompressorId, 0.1);
  }

  const spkCandidates = nextTeam.members.filter(
    m => !m.isLeader && !m.speech && m.busyUntil <= clock &&
      STAFF_ARCHETYPES[m.archetypeId].spontaneousActions.length > 0,
  );

  for (const m of spkCandidates) {
    const [chance, r1] = draw(nextRng);
    nextRng = r1;
    const rate = m.behavior.initiative * SPONTANEOUS_RATE_BASE;
    if (chance < rate) {
      const arche = STAFF_ARCHETYPES[m.archetypeId];
      const [phrase, r2] = drawChoice(nextRng, arche.spontaneousActions);
      nextRng = r2;
      const dur = speechDuration(phrase);
      nextTeam = setSpeech(nextTeam, m.id, phrase, clock + dur);
      nextReplay = append(nextReplay, clock, 'team', 'team.spontaneous_speech', {
        memberId: m.id,
        memberName: m.name,
        text: phrase,
      });
      break;
    }
  }

  return { team: nextTeam, replay: nextReplay, rng: nextRng };
}
