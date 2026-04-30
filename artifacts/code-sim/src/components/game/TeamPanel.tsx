import { useState } from 'react';
import type { TeamMemberRuntime } from '../../engine/types/team';
import type { TeamRole } from '../../engine/types/core';
import { TEAM_ROLE_LABELS, STAFF_TYPE_LABELS } from '../../engine/types/core';

interface TeamPanelProps {
  team: TeamMemberRuntime[];
  onAssignRole: (memberId: string, role: TeamRole) => void;
  onConfirmRole: (memberId: string) => void;
}

const ASSIGNABLE_ROLES: TeamRole[] = [
  'compressor',
  'airway',
  'iv_access',
  'medication',
  'monitor_defib',
  'recorder',
  'timekeeper',
  'none',
];

export default function TeamPanel({ team, onAssignRole, onConfirmRole }: TeamPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 tracking-wider">TEAM</span>
        <span className="text-[10px] text-gray-600">{team.length} in room</span>
      </div>
      <div className="space-y-1.5">
        {team.map(m => (
          <div key={m.id} className="bg-black/30 border border-gray-800/70 rounded p-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[11px] font-bold truncate ${m.isLeader ? 'text-amber-300' : 'text-gray-200'}`}>{m.name}</span>
                <span className="text-[9px] text-gray-500">{STAFF_TYPE_LABELS[m.staffType]}</span>
              </div>
              {!m.isLeader && (
                <button
                  onClick={() => setOpenId(openId === m.id ? null : m.id)}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
                >
                  ROLE
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-gray-400">{TEAM_ROLE_LABELS[m.assignedRole]}</span>
              {!m.isLeader && (
                m.confirmedRole ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/60 text-green-300">CLOSED-LOOP ✓</span>
                ) : m.assignedRole !== 'none' ? (
                  <button
                    onClick={() => onConfirmRole(m.id)}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 hover:bg-amber-900/60"
                  >
                    CONFIRM
                  </button>
                ) : null
              )}
              {m.fatigueLevel > 0.5 && (
                <span className="text-[9px] px-1 rounded bg-red-900/40 text-red-300">FATIGUED</span>
              )}
            </div>
            {openId === m.id && !m.isLeader && (
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {ASSIGNABLE_ROLES.map(r => (
                  <button
                    key={r}
                    onClick={() => { onAssignRole(m.id, r); setOpenId(null); }}
                    className={`text-[9px] px-1 py-0.5 rounded text-left ${
                      m.assignedRole === r
                        ? 'bg-blue-900/60 text-blue-200'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {TEAM_ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            )}
            {m.speech && (
              <div className="mt-1 text-[10px] italic text-gray-400 bg-gray-800/40 px-1 py-0.5 rounded">
                "{m.speech.text}"
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
