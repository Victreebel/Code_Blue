import { useState } from 'react';
import { motion } from 'framer-motion';

interface StartScreenProps {
  onStart: (seed?: string) => void;
}

export default function StartScreen({ onStart }: StartScreenProps) {
  const [seed, setSeed] = useState('');

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
            Lead a witnessed cardiac arrest. Direct your team, follow ACLS protocol, and bring order to chaos.
          </p>
        </div>

        <div
          role="note"
          aria-label="Educational disclaimer"
          className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-4 mb-6"
        >
          <div className="text-[10px] font-bold tracking-[0.2em] text-amber-300 mb-1">
            EDUCATIONAL USE ONLY
          </div>
          <p className="text-[11px] text-amber-100/90 leading-relaxed">
            This is a training and learning simulation. It is <span className="font-bold">not</span>{' '}
            a medical device, is not a substitute for professional ACLS certification or clinical
            judgment, and must not be used to direct real patient care. Clinical thresholds,
            timings, and outcomes are simplified for teaching and may differ from current AHA
            guidelines. By continuing you acknowledge this is a simulation only.
          </p>
        </div>

        <div className="bg-gray-900/60 rounded-lg border border-gray-800 p-5 mb-6">
          <h3 className="text-xs font-bold text-gray-300 mb-2 tracking-wider">SCENARIO</h3>
          <div className="text-sm text-gray-200 font-bold mb-1">Witnessed VF Arrest — Bed 4</div>
          <div className="text-xs text-gray-500 leading-relaxed">
            58 yo M, prior MI, on heparin for chest pain. Bedside RN witnesses sudden collapse.
            Telemetry shows ventricular fibrillation. You are the code leader. The team is converging.
          </div>
          <div className="mt-3 text-[11px] text-gray-500">
            Real-time, 5–8 minutes. One scenario. Two scripted chaos events: compressor fatigue,
            medication delay.
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs font-bold text-gray-500 tracking-wider mb-2 block">SEED (optional, for reproducible runs)</label>
          <input
            value={seed}
            onChange={e => setSeed(e.target.value)}
            placeholder="e.g. case-001"
            className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-800 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-700"
          />
        </div>

        <motion.button
          onClick={() => onStart(seed.trim() || undefined)}
          className="w-full py-3 rounded-lg bg-red-700 text-white font-bold text-sm hover:bg-red-600 transition-colors tracking-wider"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          RUN CODE
        </motion.button>

        <div className="mt-8 bg-gray-900/60 rounded-lg border border-gray-800 p-4">
          <h3 className="text-xs font-bold text-gray-400 mb-2">HOW TO PLAY</h3>
          <ul className="space-y-1.5 text-[11px] text-gray-500">
            <li>You are the <span className="text-gray-300">code team leader</span> — give orders, don't perform tasks yourself</li>
            <li><span className="text-gray-300">Assign roles</span> to team members and confirm their acknowledgment</li>
            <li>Follow <span className="text-gray-300">ACLS protocol</span> — rhythm checks every 2 min, epi every 3-5 min</li>
            <li><span className="text-gray-300">Charge the defibrillator</span> before delivering a shock</li>
            <li><span className="text-gray-300">Switch compressors</span> every 2 minutes to maintain CPR quality</li>
            <li>Use <span className="text-gray-300">closed-loop confirmation</span> when an order needs verification</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
