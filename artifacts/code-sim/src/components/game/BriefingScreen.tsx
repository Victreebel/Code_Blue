import { motion } from 'framer-motion';
import type { ScenarioInput } from '../../engine/types/scenario';

interface BriefingScreenProps {
  scenarioInput: ScenarioInput;
  onBegin: () => void;
}

export default function BriefingScreen({ scenarioInput, onBegin }: BriefingScreenProps) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl w-full"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-400 text-xs font-bold tracking-[0.3em]">CODE BLUE — BED 4</span>
            <div className="w-2 h-2 rounded-full bg-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100">Witnessed Cardiac Arrest</h1>
          <div className="text-xs text-gray-500 mt-1">Seed: {scenarioInput.seed}</div>
        </div>

        <div className="bg-gray-900/70 rounded-lg border border-gray-800 p-5 mb-4">
          <div className="text-xs font-bold text-gray-400 mb-2 tracking-wider">PATIENT</div>
          <div className="text-sm text-gray-200 mb-1">
            {scenarioInput.patientName}, {scenarioInput.patientAge}{scenarioInput.patientSex}, {scenarioInput.patientWeight} kg
          </div>
          <div className="text-xs text-gray-400">PMH: {scenarioInput.pmh.join(', ')}</div>
          <div className="text-xs text-gray-400 mt-1">Chief: {scenarioInput.chiefComplaint}</div>
        </div>

        <div className="bg-gray-900/70 rounded-lg border border-gray-800 p-5 mb-4">
          <div className="text-xs font-bold text-gray-400 mb-2 tracking-wider">BRIEFING</div>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{scenarioInput.briefingText}</pre>
        </div>

        <div className="bg-gray-900/70 rounded-lg border border-gray-800 p-5 mb-6">
          <div className="text-xs font-bold text-gray-400 mb-2 tracking-wider">YOUR TEAM</div>
          <div className="space-y-1.5">
            {scenarioInput.team.map(m => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <span className={m.isLeader ? 'text-amber-300 font-bold' : 'text-gray-300'}>{m.name}</span>
                <span className="text-gray-500">{m.staffType.toUpperCase()} — {m.initialRole}</span>
              </div>
            ))}
          </div>
        </div>

        <motion.button
          onClick={onBegin}
          className="w-full py-3 rounded-lg bg-red-700 text-white font-bold text-sm hover:bg-red-600 transition-colors tracking-wider"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          BEGIN CODE
        </motion.button>
      </motion.div>
    </div>
  );
}
