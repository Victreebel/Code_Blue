import { useState } from 'react';
import { motion } from 'framer-motion';
import { SEED_SCENARIOS, type SeedScenarioId } from '../../engine/scenarioGenerator';

interface StartScreenProps {
  onStart: (difficulty: 'easy' | 'medium' | 'hard', seedId?: SeedScenarioId) => void;
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [selectedSeed, setSelectedSeed] = useState<SeedScenarioId | null>(null);

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

        <div className="space-y-3 mb-6">
          {difficulties.map(d => (
            <button
              key={d.id}
              onClick={() => { setSelectedDifficulty(d.id); setSelectedSeed(null); }}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedDifficulty === d.id && !selectedSeed
                  ? `${d.color} bg-gray-900`
                  : 'border-gray-800 text-gray-400 bg-gray-900/50 hover:border-gray-600'
              }`}
            >
              <div className="font-bold text-sm">{d.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{d.desc}</div>
            </button>
          ))}
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-500 tracking-wider mb-2">OR CHOOSE A SCENARIO</h3>
          <div className="space-y-2">
            {SEED_SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedSeed(s.id); setSelectedDifficulty(s.difficulty); }}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selectedSeed === s.id
                    ? 'border-blue-500 bg-blue-950/40 text-blue-300'
                    : 'border-gray-800 text-gray-400 bg-gray-900/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{s.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    s.difficulty === 'easy' ? 'bg-green-900/50 text-green-400' :
                    s.difficulty === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                    'bg-red-900/50 text-red-400'
                  }`}>
                    {s.difficulty}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        <motion.button
          onClick={() => onStart(selectedDifficulty, selectedSeed ?? undefined)}
          className="w-full py-3 rounded-lg bg-red-700 text-white font-bold text-sm hover:bg-red-600 transition-colors tracking-wider"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {selectedSeed ? 'RUN SCENARIO' : 'RUN CODE'}
        </motion.button>

        <div className="mt-8 bg-gray-900/60 rounded-lg border border-gray-800 p-4">
          <h3 className="text-xs font-bold text-gray-400 mb-2">HOW TO PLAY</h3>
          <ul className="space-y-1.5 text-[11px] text-gray-500">
            <li>You are the <span className="text-gray-300">code team leader</span> — give orders, don't perform tasks yourself</li>
            <li><span className="text-gray-300">Assign roles</span> to team members and confirm their acknowledgment</li>
            <li>Follow <span className="text-gray-300">ACLS protocol</span> — rhythm checks every 2 min, epi every 3-5 min</li>
            <li><span className="text-gray-300">Charge the defibrillator</span> before delivering a shock</li>
            <li><span className="text-gray-300">Identify and treat</span> the reversible cause (H's and T's)</li>
            <li>Handle <span className="text-gray-300">complications</span> — equipment failures, overcrowding, fatigue</li>
            <li><span className="text-gray-300">Switch compressors</span> every 2 minutes to maintain CPR quality</li>
            <li><span className="text-gray-300">Clear the room</span> of non-essential personnel if overcrowded</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
