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

export interface TeamTickOutput {
  team: TeamState;
  replay: ReplayState;
  rng: RngState;
}

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

  if (clock > 0 && Math.floor(clock) % 30 === 0 && Math.abs(clock - Math.floor(clock)) < 0.05) {
    const idle = nextTeam.members.filter(
      m => !m.isLeader && !m.speech && m.busyUntil <= clock && m.assignedRole !== 'none',
    );
    if (idle.length > 0) {
      const [picked, r1] = drawChoice(nextRng, idle);
      nextRng = r1;
      const arche = STAFF_ARCHETYPES[picked.archetypeId];
      if (arche.spontaneousActions.length > 0) {
        const [chance, r2] = draw(nextRng);
        nextRng = r2;
        if (chance < picked.behavior.initiative * 0.3) {
          const [phrase, r3] = drawChoice(nextRng, arche.spontaneousActions);
          nextRng = r3;
          nextTeam = setSpeech(nextTeam, picked.id, phrase, clock + 4);
          nextReplay = append(nextReplay, clock, 'team', 'team.spontaneous_speech', {
            memberId: picked.id,
            memberName: picked.name,
            text: phrase,
          });
        }
      }
    }
  }

  return { team: nextTeam, replay: nextReplay, rng: nextRng };
}
