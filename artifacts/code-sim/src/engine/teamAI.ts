import { type TeamMember, type TeamRole, type GameState, type OrderFailureMode, TEAM_ROLE_LABELS, STAFF_TYPE_LABELS } from './types';
import { STAFF_ARCHETYPES } from './staffArchetypes';
import { generateNewTeamMember } from './scenarioGenerator';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getTeamSpeechOnAssignment(member: TeamMember, role: TeamRole): { message: string; delay: number } {
  const roleLabel = TEAM_ROLE_LABELS[role];
  const archetype = member.archetypeId ? STAFF_ARCHETYPES[member.archetypeId] : null;
  const speed = member.behavior.executionSpeed;
  const baseDelay = (1 - speed) * 4 + 0.5;

  if (member.behavior.clarificationTendency > 0.5 && Math.random() < member.behavior.clarificationTendency) {
    const phrases = archetype?.clarificationPhrases ?? [
      `Just to clarify — you want me on ${roleLabel.toLowerCase()}?`,
      `${roleLabel}? Me?`,
    ];
    return { message: pick(phrases), delay: baseDelay + 2 };
  }

  if (member.compliance === 'resistant') {
    const responses = [
      `I'm not sure I'm comfortable doing ${roleLabel.toLowerCase()}...`,
      `Can someone else handle ${roleLabel.toLowerCase()}? I'm not the best for this.`,
      `I think there's someone more qualified for ${roleLabel.toLowerCase()}.`,
    ];
    return { message: pick(responses), delay: baseDelay + 2 };
  }

  if (member.behavior.assertiveness > 0.8) {
    const responses = [
      `I'll take ${roleLabel.toLowerCase()}, but I think we need to move faster.`,
      `${roleLabel}, got it. Let's pick up the pace.`,
      `On it. What took so long?`,
    ];
    return { message: pick(responses), delay: baseDelay * 0.5 };
  }

  if (member.compliance === 'independent') {
    const responses = [
      `Got it, I'll take ${roleLabel.toLowerCase()}.`,
      `On it.`,
      `Already working on that.`,
      `${roleLabel}, confirmed.`,
    ];
    return { message: pick(responses), delay: baseDelay };
  }

  const responses = [
    `${roleLabel}, confirmed!`,
    `I'm on ${roleLabel.toLowerCase()}.`,
    `Copy, ${roleLabel.toLowerCase()}.`,
    `Understood, taking ${roleLabel.toLowerCase()}.`,
  ];
  return { message: pick(responses), delay: baseDelay };
}

export function processSelfAssignments(state: GameState): { memberId: string; role: TeamRole; message: string }[] {
  const results: { memberId: string; role: TeamRole; message: string }[] = [];

  for (const member of state.team) {
    if (!member.inRoom || member.assignedRole !== 'none' || member.busy) continue;

    const archetype = member.archetypeId ? STAFF_ARCHETYPES[member.archetypeId] : null;

    if (member.selfAssignedRole) {
      if (Math.random() > member.behavior.initiative * 0.5) continue;
      const role = member.selfAssignedRole;
      const alreadyTaken = state.team.some(m => m.id !== member.id && m.assignedRole === role && m.confirmedRole);
      if (alreadyTaken) continue;

      const defaultMsgs = [
        `I'll go ahead and take ${TEAM_ROLE_LABELS[role].toLowerCase()}.`,
        `Nobody's doing ${TEAM_ROLE_LABELS[role].toLowerCase()} yet, I'll handle it.`,
      ];
      const msgs = archetype?.spontaneousActions.length ? archetype.spontaneousActions : defaultMsgs;
      results.push({ memberId: member.id, role, message: pick(msgs) });
      continue;
    }

    if (member.behavior.initiative > 0.7 && Math.random() < member.behavior.initiative * 0.15) {
      const unfilledRoles: TeamRole[] = ['compressor', 'airway', 'iv_access', 'monitor_defib', 'medication'];
      const availableRoles = unfilledRoles.filter(r =>
        !state.team.some(m => m.id !== member.id && m.assignedRole === r && m.confirmedRole)
      );
      if (availableRoles.length === 0) continue;

      const preferred = archetype?.preferredRoles.filter(r => availableRoles.includes(r)) ?? [];
      const chosenRole = preferred.length > 0 ? pick(preferred) : pick(availableRoles);

      const msgs = archetype?.spontaneousActions.length
        ? archetype.spontaneousActions
        : [`I'll take ${TEAM_ROLE_LABELS[chosenRole].toLowerCase()}.`];

      results.push({ memberId: member.id, role: chosenRole, message: pick(msgs) });
    }
  }

  return results;
}

export interface SpontaneousEvent {
  memberId: string;
  message: string;
  eventType: 'clarification' | 'delay' | 'wrong_task' | 'duplicate' | 'distraction' | 'initiative';
}

export function generateSpontaneousBehaviors(state: GameState): SpontaneousEvent[] {
  const events: SpontaneousEvent[] = [];
  if (Math.random() > 0.12) return events;

  for (const member of state.team) {
    if (!member.inRoom || member.speechBubble || member.busy) continue;
    if (state.clock - member.lastActionTime < 15) continue;

    const archetype = member.archetypeId ? STAFF_ARCHETYPES[member.archetypeId] : null;

    if (member.behavior.distractibility > 0.5 && Math.random() < member.behavior.distractibility * 0.1) {
      const phrases = archetype?.delayPhrases.length ? archetype.delayPhrases : [
        'Sorry, I got distracted for a moment.',
        'Wait, what was I doing?',
      ];
      events.push({ memberId: member.id, message: pick(phrases), eventType: 'distraction' });
      continue;
    }

    if (member.behavior.clarificationTendency > 0.4 && Math.random() < member.behavior.clarificationTendency * 0.08
      && state.pendingOrders.some(o => o.status === 'heard' || o.status === 'acknowledged')) {
      const phrases = archetype?.clarificationPhrases.length ? archetype.clarificationPhrases : [
        'Sorry, can you repeat the order?',
        'Which medication did you say?',
      ];
      events.push({ memberId: member.id, message: pick(phrases), eventType: 'clarification' });
      continue;
    }

    if (member.behavior.initiative > 0.8 && member.behavior.assertiveness > 0.7 && Math.random() < 0.06) {
      const msgs = archetype?.spontaneousActions.length ? archetype.spontaneousActions : [
        'We need to move faster.',
      ];
      events.push({ memberId: member.id, message: pick(msgs), eventType: 'initiative' });
      continue;
    }

    if (member.behavior.distractibility > 0.6 && Math.random() < 0.04) {
      const wrongMsgs = archetype?.wrongTaskPhrases.length ? archetype.wrongTaskPhrases : [
        'Wait, I thought you said something else...',
      ];
      events.push({ memberId: member.id, message: pick(wrongMsgs), eventType: 'wrong_task' });
    }
  }

  return events;
}

export function determineOrderFailureMode(
  member: TeamMember | undefined,
  state: GameState,
  orderType: string,
): OrderFailureMode {
  if (!member || !member.inRoom) return 'not_heard';

  const distractibility = member.behavior.distractibility;
  const speed = member.behavior.executionSpeed;

  const roll = Math.random();
  if (roll < distractibility * 0.3) return 'not_heard';

  if (orderType.startsWith('medication_') && !state.patient.hasIV && !state.patient.hasIO) {
    return 'blocked_by_missing_prerequisite';
  }

  const duplicateOrder = state.pendingOrders.find(o =>
    o.actionType === orderType && o.id !== '' &&
    (o.status === 'in_progress' || o.status === 'acknowledged') &&
    o.targetMemberId !== member.id
  );
  if (duplicateOrder && Math.random() < 0.3) return 'duplicated';

  if (speed < 0.4 && Math.random() < 0.4) return 'acknowledged_but_delayed';

  if (member.fatigueLevel > 0.7 && Math.random() < 0.3) return 'abandoned';

  if (member.competence === 'low' && Math.random() < 0.2) return 'performed_incorrectly';

  const wrongPerson = state.team.find(m =>
    m.inRoom && m.id !== member.id && !m.busy &&
    m.behavior.initiative > 0.7 && Math.random() < 0.15
  );
  if (wrongPerson) return 'heard_by_wrong_person';

  return 'performed_incorrectly';
}

export function generateAmbientSpeech(state: GameState): { memberId: string; message: string }[] {
  const speeches: { memberId: string; message: string }[] = [];
  if (Math.random() > 0.15) return speeches;

  const activeMember = state.team.find(m => m.inRoom && !m.speechBubble && m.assignedRole !== 'none');
  if (!activeMember) return speeches;

  const elapsed = state.clock;
  const archetype = activeMember.archetypeId ? STAFF_ARCHETYPES[activeMember.archetypeId] : null;

  if (activeMember.assignedRole === 'compressor' && state.patient.cprInProgress) {
    const msgs = [
      'Compressing... 1, 2, 3, 4, 5...',
      'Good compressions, full recoil...',
      'Maintaining rate and depth...',
    ];
    if (activeMember.fatigueLevel > 0.5) {
      msgs.push("I'm getting fatigued, need a switch soon!");
      msgs.push('Getting tired here, can someone take over compressions?');
    }
    if (elapsed - state.cprCycleStart > 90) {
      msgs.push("My arms are getting heavy, seriously need a switch!");
    }
    speeches.push({ memberId: activeMember.id, message: pick(msgs) });
  } else if (activeMember.assignedRole === 'airway') {
    const msgs = [
      'Bagging patient, good chest rise.',
      'Maintaining airway.',
      state.patient.hasAdvancedAirway ? 'Advanced airway in place, securing.' : 'BVM ventilating.',
    ];
    speeches.push({ memberId: activeMember.id, message: pick(msgs) });
  } else if (activeMember.assignedRole === 'monitor_defib') {
    const msgs = [
      `Monitor shows ${state.patient.rhythm === 'vfib' ? 'V-fib' : state.patient.rhythm === 'vtach' ? 'V-tach' : state.patient.rhythm === 'pea' ? 'PEA' : state.patient.rhythm === 'asystole' ? 'flatline' : 'a rhythm'}.`,
      'Pads are on, ready to analyze.',
      `EtCO2 is ${state.patient.etco2}.`,
    ];
    speeches.push({ memberId: activeMember.id, message: pick(msgs) });
  } else if (activeMember.assignedRole === 'medication' || activeMember.assignedRole === 'iv_access') {
    if (state.patient.hasIV) {
      const msgs = archetype?.id === 'efficient_pharmacist'
        ? archetype.spontaneousActions
        : ['IV patent, ready for meds.', 'Line is good, standing by for medication orders.'];
      speeches.push({ memberId: activeMember.id, message: pick(msgs) });
    } else {
      speeches.push({ memberId: activeMember.id, message: pick(['Working on IV access...', 'Trying to get a line in...', 'Having some difficulty with access.']) });
    }
  }

  return speeches;
}

export function handleComplication(type: string, state: GameState): {
  messages: { memberId: string; message: string }[];
  stateUpdates: Partial<GameState>;
  newMembers?: TeamMember[];
} {
  const messages: { memberId: string; message: string }[] = [];
  const stateUpdates: Partial<GameState> = {};
  const usedNames = new Set(state.team.map(m => m.name));

  switch (type) {
    case 'cpr_fatigue': {
      const compressor = state.team.find(m => m.assignedRole === 'compressor' && m.inRoom);
      if (compressor) {
        messages.push({ memberId: compressor.id, message: "I'm getting really tired, I need someone to take over compressions!" });
      }
      break;
    }
    case 'new_staff_arrives': {
      const newMember = generateNewTeamMember(usedNames);
      const arrivals = [
        `${STAFF_TYPE_LABELS[newMember.staffType]} ${newMember.name} here, what do you need?`,
        `Just got here. ${STAFF_TYPE_LABELS[newMember.staffType]} ${newMember.name}. How can I help?`,
        `${newMember.name}, ${STAFF_TYPE_LABELS[newMember.staffType]}. What's going on?`,
      ];
      messages.push({ memberId: newMember.id, message: pick(arrivals) });
      return { messages, stateUpdates, newMembers: [newMember] };
    }
    case 'overcrowding': {
      const extra1 = generateNewTeamMember(usedNames);
      usedNames.add(extra1.name);
      const extra2 = generateNewTeamMember(usedNames);
      messages.push({ memberId: extra1.id, message: "What's happening? Can I help?" });
      messages.push({ memberId: extra2.id, message: 'I heard there was a code, came to see if you needed anything.' });
      return { messages, stateUpdates, newMembers: [extra1, extra2] };
    }
    case 'iv_lost': {
      messages.push({
        memberId: state.team.find(m => m.assignedRole === 'iv_access' || m.assignedRole === 'medication')?.id || state.team[0]?.id || '',
        message: 'The IV just infiltrated! We lost our line!',
      });
      break;
    }
    case 'equipment_failure': {
      const monitor = state.team.find(m => m.assignedRole === 'monitor_defib');
      if (monitor) {
        messages.push({ memberId: monitor.id, message: "The defibrillator isn't charging! Let me try to fix it!" });
      }
      break;
    }
    case 'family_arrives': {
      const anyMember = state.team.find(m => m.inRoom && !m.speechBubble);
      if (anyMember) {
        messages.push({ memberId: anyMember.id, message: "The patient's family is at the door asking what's happening. They're very upset." });
      }
      break;
    }
    case 'lab_results': {
      const cause = state.scenario?.reversibleCause;
      let labMsg = 'Lab results are back.';
      if (cause === 'hyperkalemia') labMsg = 'CRITICAL LAB: Potassium 7.8 mEq/L!';
      else if (cause === 'hypokalemia') labMsg = 'CRITICAL LAB: Potassium 2.1 mEq/L!';
      else if (cause === 'acidosis') labMsg = 'ABG back: pH 6.9, pCO2 60, HCO3 8. Severe acidosis!';
      else if (cause === 'hypothermia') labMsg = 'Core temp 28°C / 82.4°F!';
      else labMsg = 'Labs back — CBC, BMP, troponin pending. Let me pull them up.';

      const reportTo = state.team.find(m => m.inRoom && !m.speechBubble);
      if (reportTo) {
        messages.push({ memberId: reportTo.id, message: labMsg });
      }
      break;
    }
    case 'staff_leaves': {
      const nonEssential = state.team.find(m =>
        m.inRoom && m.assignedRole === 'none' && m.staffType !== 'nurse'
      );
      if (nonEssential) {
        messages.push({ memberId: nonEssential.id, message: "I'm getting paged, I have to go!" });
      }
      break;
    }
    case 'difficult_airway': {
      const airwayPerson = state.team.find(m => m.assignedRole === 'airway');
      if (airwayPerson) {
        messages.push({ memberId: airwayPerson.id, message: "I can't visualize the cords! This is a difficult airway! Grade 3 view!" });
      }
      break;
    }
    case 'rhythm_change': {
      break;
    }
  }

  return { messages, stateUpdates };
}
