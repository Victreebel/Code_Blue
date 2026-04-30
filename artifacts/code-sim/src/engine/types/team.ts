import type { TeamRole, StaffType, Competence, Compliance } from './core';
import type { BehaviorProfile, StaffArchetypeId } from './scenario';

export interface TeamMemberRuntime {
  id: string;
  name: string;
  staffType: StaffType;
  archetypeId: StaffArchetypeId;
  competence: Competence;
  compliance: Compliance;
  behavior: BehaviorProfile;
  isLeader: boolean;
  assignedRole: TeamRole;
  confirmedRole: boolean;
  inRoom: boolean;
  busyUntil: number;
  fatigueLevel: number;
  speech: { text: string; until: number } | null;
  currentOrderId: string | null;
}

export interface TeamState {
  members: TeamMemberRuntime[];
}
