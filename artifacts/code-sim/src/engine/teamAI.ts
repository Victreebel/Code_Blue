import { type TeamMember, type TeamRole, type GameState, TEAM_ROLE_LABELS, STAFF_TYPE_LABELS } from './types';
import { generateNewTeamMember } from './scenarioGenerator';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getTeamSpeechOnAssignment(member: TeamMember, role: TeamRole): { message: string; delay: number } {
  const roleLabel = TEAM_ROLE_LABELS[role];
  if (member.compliance === 'resistant') {
    const responses = [
      `I'm not sure I'm comfortable doing ${roleLabel.toLowerCase()}...`,
      `Can someone else handle ${roleLabel.toLowerCase()}? I'm not the best for this.`,
      `I think there's someone more qualified for ${roleLabel.toLowerCase()}.`,
    ];
    return { message: pick(responses), delay: Math.random() * 3 + 2 };
  }
  if (member.compliance === 'independent') {
    const responses = [
      `Got it, I'll take ${roleLabel.toLowerCase()}.`,
      `On it.`,
      `Already working on that.`,
      `${roleLabel}, confirmed.`,
    ];
    return { message: pick(responses), delay: Math.random() * 2 + 0.5 };
  }
  const responses = [
    `${roleLabel}, confirmed!`,
    `I'm on ${roleLabel.toLowerCase()}.`,
    `Copy, ${roleLabel.toLowerCase()}.`,
    `Understood, taking ${roleLabel.toLowerCase()}.`,
  ];
  return { message: pick(responses), delay: Math.random() * 1.5 + 0.5 };
}

export function processSelfAssignments(state: GameState): { memberId: string; role: TeamRole; message: string }[] {
  const results: { memberId: string; role: TeamRole; message: string }[] = [];

  for (const member of state.team) {
    if (!member.inRoom || !member.selfAssignedRole || member.assignedRole !== 'none') continue;
    if (Math.random() > 0.3) continue;

    const role = member.selfAssignedRole;
    const alreadyTaken = state.team.some(m => m.id !== member.id && m.assignedRole === role && m.confirmedRole);
    if (alreadyTaken && Math.random() > 0.3) continue;

    const messages = [
      `I'll go ahead and take ${TEAM_ROLE_LABELS[role].toLowerCase()}.`,
      `I'm starting ${TEAM_ROLE_LABELS[role].toLowerCase()}, someone needs to do it.`,
      `Nobody's doing ${TEAM_ROLE_LABELS[role].toLowerCase()} yet, I'll handle it.`,
      `I'm going to do ${TEAM_ROLE_LABELS[role].toLowerCase()}.`,
    ];

    results.push({
      memberId: member.id,
      role,
      message: pick(messages),
    });
  }

  return results;
}

export function generateAmbientSpeech(state: GameState): { memberId: string; message: string }[] {
  const speeches: { memberId: string; message: string }[] = [];
  if (Math.random() > 0.15) return speeches;

  const activeMember = state.team.find(m => m.inRoom && !m.speechBubble && m.assignedRole !== 'none');
  if (!activeMember) return speeches;

  const elapsed = state.clock;

  if (activeMember.assignedRole === 'compressor' && state.patient.cprInProgress) {
    const msgs = [
      'Compressing... 1, 2, 3, 4, 5...',
      'Good compressions, full recoil...',
      'My arms are getting tired...',
      'Maintaining rate and depth...',
    ];
    if (elapsed - state.cprCycleStart > 90) {
      msgs.push("I'm getting fatigued, need a switch soon!");
      msgs.push('Getting tired here, can someone take over compressions?');
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
      speeches.push({ memberId: activeMember.id, message: pick(['IV patent, ready for meds.', 'Line is good, standing by for medication orders.']) });
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
