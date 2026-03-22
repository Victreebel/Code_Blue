import { useState } from 'react';
import { motion } from 'framer-motion';

interface StartScreenProps {
  onStart: (difficulty: 'easy' | 'medium' | 'hard') => void;
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  const difficulties = [
    { id: 'easy' as const, label: 'Intern', desc: 'Fewer team members, fewer complications, more forgiving timing', color: 'border-green-600 text-green-400' },
    { id: 'medium' as const, label: 'Resident', desc: 'Standard team size, moderate complications, ACLS timing expected', color: 'border-yellow-600 text-yellow-400' },
    { id: 'hard' as const, label: 'Attending', desc: 'Larger team, frequent complications, overcrowding, strict timing', color: 'border-red-600 text-red-400' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-lg w-full"
      >
        <div className="text-center mb-10">
          <motion.div
            className="inline-flex items-center gap-2 mb-4"
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-red-400 text-sm font-bold tracking-[0.3em]">CODE BLUE</span>
            <div className="w-3 h-3 rounded-full bg-red-500" />
          </motion.div>
          <h1 className="text-4xl font-bold text-gray-100 mb-2">ACLS Code Simulator</h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Lead a cardiac arrest resuscitation. Manage your team, follow ACLS protocol,
            identify reversible causes, and bring order to chaos.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {difficulties.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDifficulty(d.id)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedDifficulty === d.id
                  ? `${d.color} bg-gray-900`
                  : 'border-gray-800 text-gray-400 bg-gray-900/50 hover:border-gray-600'
              }`}
            >
              <div className="font-bold text-sm">{d.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{d.desc}</div>
            </button>
          ))}
        </div>

        <motion.button
          onClick={() => onStart(selectedDifficulty)}
          className="w-full py-3 rounded-lg bg-red-700 text-white font-bold text-sm hover:bg-red-600 transition-colors tracking-wider"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          RUN CODE
        </motion.button>

        <div className="mt-8 bg-gray-900/60 rounded-lg border border-gray-800 p-4">
          <h3 className="text-xs font-bold text-gray-400 mb-2">HOW TO PLAY</h3>
          <ul className="space-y-1.5 text-[11px] text-gray-500">
            <li>• You are the <span className="text-gray-300">code team leader</span> — give orders, don't perform tasks yourself</li>
            <li>• <span className="text-gray-300">Assign roles</span> to team members and confirm their acknowledgment</li>
            <li>• Follow <span className="text-gray-300">ACLS protocol</span> — rhythm checks every 2 min, epi every 3-5 min</li>
            <li>• <span className="text-gray-300">Identify and treat</span> the reversible cause (H's and T's)</li>
            <li>• Handle <span className="text-gray-300">complications</span> — equipment failures, overcrowding, fatigue</li>
            <li>• Use <span className="text-gray-300">closed-loop communication</span> — confirm orders are received</li>
            <li>• You can <span className="text-gray-300">remove non-essential personnel</span> from the room</li>
            <li>• Call <span className="text-gray-300">time of death</span> if you believe ROSC is not achievable</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
