import { type TeamMember, type TeamRole, TEAM_ROLE_LABELS, STAFF_TYPE_LABELS } from '../../engine/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface TeamPanelProps {
  team: TeamMember[];
  onAssignRole: (memberId: string, role: TeamRole) => void;
  onConfirmRole: (memberId: string) => void;
  onKickMember: (memberId: string) => void;
  roomCapacity: number;
}

const ROLE_OPTIONS: TeamRole[] = ['compressor', 'airway', 'iv_access', 'medication', 'monitor_defib', 'recorder', 'timekeeper'];

const COMPETENCE_COLORS = {
  low: 'border-red-600/50',
  medium: 'border-yellow-600/50',
  high: 'border-green-600/50',
};

const STAFF_ICONS: Record<string, string> = {
  nurse: '🩺',
  resident: '👨‍⚕️',
  attending: '👩‍⚕️',
  rt: '💨',
  tech: '🔧',
  student: '📚',
  pharmacist: '💊',
};

export default function TeamPanel({ team, onAssignRole, onConfirmRole, onKickMember, roomCapacity }: TeamPanelProps) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const inRoom = team.filter(m => m.inRoom);
  const isOvercrowded = inRoom.length > roomCapacity;

  return (
    <div className="bg-gray-900/90 rounded-lg border border-gray-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-300 tracking-wider">CODE TEAM</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded ${isOvercrowded ? 'bg-red-900/60 text-red-400 animate-pulse' : 'bg-gray-800 text-gray-400'}`}>
          {inRoom.length}/{roomCapacity} in room
        </span>
      </div>

      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        <AnimatePresence>
          {inRoom.map((member) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`relative p-2 rounded border ${COMPETENCE_COLORS[member.competence]} bg-gray-800/80 cursor-pointer ${selectedMember === member.id ? 'ring-1 ring-blue-500' : ''}`}
              onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{STAFF_ICONS[member.staffType] || '👤'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-gray-200 truncate">{member.name}</span>
                    <span className="text-[10px] text-gray-500">({STAFF_TYPE_LABELS[member.staffType]})</span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {member.assignedRole !== 'none' ? (
                      <span className={member.confirmedRole ? 'text-green-400' : 'text-yellow-400'}>
                        {TEAM_ROLE_LABELS[member.assignedRole]}
                        {!member.confirmedRole && ' (unconfirmed)'}
                      </span>
                    ) : member.selfAssignedRole ? (
                      <span className="text-orange-400">
                        Self-assigned: {TEAM_ROLE_LABELS[member.selfAssignedRole]}
                      </span>
                    ) : (
                      <span className="text-gray-600">Unassigned</span>
                    )}
                  </div>
                </div>
                {member.busy && (
                  <motion.div
                    className="w-2 h-2 rounded-full bg-yellow-500"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                )}
              </div>

              <AnimatePresence>
                {member.speechBubble && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.9 }}
                    className="mt-1.5 relative bg-white text-gray-900 text-[11px] px-2.5 py-1.5 rounded-lg shadow-md"
                  >
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-white rotate-45" />
                    <p className="relative z-10 leading-snug">"{member.speechBubble}"</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {selectedMember === member.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="text-[10px] text-gray-500 mb-1">Assign role:</div>
                      <div className="flex flex-wrap gap-1">
                        {ROLE_OPTIONS.map(role => (
                          <button
                            key={role}
                            onClick={(e) => { e.stopPropagation(); onAssignRole(member.id, role); setSelectedMember(null); }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 hover:bg-blue-800/70 transition-colors"
                          >
                            {TEAM_ROLE_LABELS[role]}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        {!member.confirmedRole && member.assignedRole !== 'none' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onConfirmRole(member.id); }}
                            className="text-[10px] px-2 py-0.5 rounded bg-green-900/50 text-green-300 hover:bg-green-800/70"
                          >
                            Confirm Role
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onKickMember(member.id); setSelectedMember(null); }}
                          className="text-[10px] px-2 py-0.5 rounded bg-red-900/50 text-red-300 hover:bg-red-800/70"
                        >
                          Remove from Room
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
