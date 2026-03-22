import { type Scenario, RHYTHM_LABELS, STAFF_TYPE_LABELS } from '../../engine/types';
import { motion } from 'framer-motion';

interface BriefingScreenProps {
  scenario: Scenario;
  onBegin: () => void;
}

export default function BriefingScreen({ scenario, onBegin }: BriefingScreenProps) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-xl w-full"
      >
        <motion.div
          className="text-center mb-6"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: 3 }}
        >
          <div className="text-red-500 text-2xl font-bold tracking-[0.4em] mb-1">CODE BLUE</div>
          <div className="text-gray-500 text-xs">INCOMING</div>
        </motion.div>

        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <div className="border-b border-gray-800 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-200">{scenario.patientName}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {scenario.patientAge}-year-old {scenario.patientSex === 'M' ? 'male' : 'female'} | {scenario.patientWeight} kg
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500 text-xs">Chief Complaint:</span>
              <p className="text-gray-200 mt-0.5">{scenario.chiefComplaint}</p>
            </div>

            <div>
              <span className="text-gray-500 text-xs">Past Medical History:</span>
              <p className="text-gray-200 mt-0.5">{scenario.pmh.join(', ')}</p>
            </div>

            <div>
              <span className="text-gray-500 text-xs">Situation:</span>
              <p className="text-gray-300 mt-0.5 leading-relaxed">{scenario.briefingText}</p>
            </div>

            <div className="bg-gray-800/60 rounded-lg p-3 mt-4">
              <span className="text-gray-500 text-xs">Initial Team Available:</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {scenario.initialTeam.map(m => (
                  <span key={m.id} className="text-xs bg-gray-700/60 text-gray-300 px-2 py-0.5 rounded">
                    {m.name} ({STAFF_TYPE_LABELS[m.staffType]})
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-red-900/20 rounded-lg p-3 border border-red-900/40">
              <p className="text-xs text-red-400">
                Patient is unresponsive. No pulse. You are the code team leader. The clock starts when you begin.
              </p>
            </div>
          </div>
        </div>

        <motion.button
          onClick={onBegin}
          className="w-full mt-6 py-3 rounded-lg bg-red-700 text-white font-bold text-sm hover:bg-red-600 transition-colors tracking-wider"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          BEGIN CODE
        </motion.button>
      </motion.div>
    </div>
  );
}
