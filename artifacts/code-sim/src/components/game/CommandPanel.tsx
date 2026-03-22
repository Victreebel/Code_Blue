import { useState } from 'react';
import { type MedicationType, type ReversibleCause, MEDICATION_LABELS, REVERSIBLE_CAUSE_LABELS, H_CAUSES, T_CAUSES } from '../../engine/types';
import { isShockable } from '../../engine/aclsProtocol';
import { type PatientState } from '../../engine/types';
import { motion } from 'framer-motion';

interface CommandPanelProps {
  patient: PatientState;
  defibCharged: boolean;
  onOrderCPR: () => void;
  onOrderStopCPR: () => void;
  onOrderRhythmCheck: () => void;
  onOrderPulseCheck: () => void;
  onOrderShock: () => void;
  onChargeDefib: () => void;
  onRequestCompressorSwitch: () => void;
  onAnnounceCycle: () => void;
  onClearRoom: () => void;
  onOrderMedication: (med: MedicationType, dose: string) => void;
  onOrderAirway: (advanced: boolean) => void;
  onOrderIVAccess: (io: boolean) => void;
  onIdentifyCause: (cause: ReversibleCause) => void;
  onTreatCause: () => void;
  onCallTimeOfDeath: () => void;
}

type PanelTab = 'cpr' | 'meds' | 'airway' | 'causes' | 'team';

export default function CommandPanel({
  patient, defibCharged, onOrderCPR, onOrderStopCPR, onOrderRhythmCheck, onOrderPulseCheck, onOrderShock,
  onChargeDefib, onRequestCompressorSwitch, onAnnounceCycle, onClearRoom,
  onOrderMedication, onOrderAirway, onOrderIVAccess, onIdentifyCause,
  onTreatCause, onCallTimeOfDeath,
}: CommandPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('cpr');
  const [confirmTOD, setConfirmTOD] = useState(false);

  const tabs: { id: PanelTab; label: string; color: string }[] = [
    { id: 'cpr', label: 'CPR/Defib', color: 'text-red-400' },
    { id: 'meds', label: 'Meds', color: 'text-blue-400' },
    { id: 'airway', label: 'Airway/IV', color: 'text-cyan-400' },
    { id: 'causes', label: "H's & T's", color: 'text-purple-400' },
    { id: 'team', label: 'Team/Other', color: 'text-gray-400' },
  ];

  const cmdBtn = (label: string, onClick: () => void, color: string, disabled = false) => (
    <button
      key={label}
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left text-xs px-3 py-2 rounded transition-all ${disabled
        ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
        : `${color} hover:brightness-125 active:scale-[0.98]`
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-gray-900/90 rounded-lg border border-gray-700 p-3">
      <h3 className="text-xs font-bold text-gray-300 tracking-wider mb-2">ORDERS</h3>

      <div className="flex gap-1 mb-3 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-[10px] px-2 py-1 rounded whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? `${tab.color} bg-gray-800 font-bold`
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
        {activeTab === 'cpr' && (
          <>
            {!patient.cprInProgress
              ? cmdBtn('Start CPR', onOrderCPR, 'bg-red-900/60 text-red-300')
              : cmdBtn('Hold CPR (for rhythm check)', onOrderStopCPR, 'bg-yellow-900/60 text-yellow-300')
            }
            {cmdBtn('Rhythm Check', onOrderRhythmCheck, 'bg-green-900/60 text-green-300')}
            {cmdBtn('Pulse Check', onOrderPulseCheck, 'bg-pink-900/60 text-pink-300')}
            <div className="border-t border-gray-700 my-2" />
            {cmdBtn(
              defibCharged ? 'Defib CHARGED — Ready' : 'Charge Defibrillator (200J)',
              onChargeDefib,
              defibCharged ? 'bg-orange-800/80 text-orange-200 font-bold' : 'bg-orange-900/60 text-orange-300',
              defibCharged,
            )}
            {cmdBtn(
              'Shock (Defibrillate)',
              onOrderShock,
              'bg-orange-900/60 text-orange-300',
              !isShockable(patient.rhythm) || !defibCharged,
            )}
            {!defibCharged && isShockable(patient.rhythm) && (
              <p className="text-[10px] text-orange-400 px-1">Charge defib before shocking</p>
            )}
          </>
        )}

        {activeTab === 'meds' && (
          <>
            {cmdBtn(
              'Epinephrine 1mg IV/IO',
              () => onOrderMedication('epinephrine', '1mg IV/IO'),
              'bg-blue-900/60 text-blue-300',
              !patient.hasIV && !patient.hasIO,
            )}
            {cmdBtn(
              `Amiodarone ${patient.amiodaroneDoses === 0 ? '300mg' : '150mg'} IV/IO`,
              () => onOrderMedication('amiodarone', patient.amiodaroneDoses === 0 ? '300mg IV/IO' : '150mg IV/IO'),
              'bg-blue-900/60 text-blue-300',
              (!patient.hasIV && !patient.hasIO) || patient.amiodaroneDoses >= 2,
            )}
            {cmdBtn(
              'Lidocaine 1-1.5mg/kg IV',
              () => onOrderMedication('lidocaine', '100mg IV'),
              'bg-blue-900/60 text-blue-300',
              !patient.hasIV && !patient.hasIO,
            )}
            {cmdBtn(
              'Sodium Bicarbonate 1mEq/kg',
              () => onOrderMedication('bicarb', '1mEq/kg IV'),
              'bg-blue-900/60 text-blue-300',
              !patient.hasIV && !patient.hasIO,
            )}
            {cmdBtn(
              'Calcium Chloride 1g IV',
              () => onOrderMedication('calcium', '1g IV'),
              'bg-blue-900/60 text-blue-300',
              !patient.hasIV && !patient.hasIO,
            )}
            {cmdBtn(
              'Magnesium Sulfate 2g IV',
              () => onOrderMedication('magnesium', '2g IV'),
              'bg-blue-900/60 text-blue-300',
              !patient.hasIV && !patient.hasIO,
            )}
            {(!patient.hasIV && !patient.hasIO) && (
              <p className="text-[10px] text-red-400 mt-1 px-1">No IV/IO access — establish access first</p>
            )}
          </>
        )}

        {activeTab === 'airway' && (
          <>
            {cmdBtn('BVM Ventilation', () => onOrderAirway(false), 'bg-cyan-900/60 text-cyan-300')}
            {cmdBtn(
              'Advanced Airway (Intubation)',
              () => onOrderAirway(true),
              'bg-cyan-900/60 text-cyan-300',
              patient.hasAdvancedAirway,
            )}
            {patient.hasAdvancedAirway && (
              <p className="text-[10px] text-green-400 px-1">Advanced airway in place</p>
            )}
            <div className="border-t border-gray-700 my-2" />
            {cmdBtn(
              'Start IV (Peripheral)',
              () => onOrderIVAccess(false),
              'bg-teal-900/60 text-teal-300',
              patient.hasIV,
            )}
            {cmdBtn(
              'Place IO (Intraosseous)',
              () => onOrderIVAccess(true),
              'bg-teal-900/60 text-teal-300',
              patient.hasIO,
            )}
          </>
        )}

        {activeTab === 'causes' && (
          <>
            <div className="text-[10px] text-gray-500 px-1 mb-1 font-bold">H's:</div>
            {H_CAUSES.map(cause => cmdBtn(
              `${patient.reversibleCauseIdentified && patient.reversibleCause === cause ? '✓ ' : ''}${REVERSIBLE_CAUSE_LABELS[cause]}`,
              () => onIdentifyCause(cause),
              'bg-purple-900/60 text-purple-300',
            ))}
            <div className="text-[10px] text-gray-500 px-1 mb-1 mt-2 font-bold">T's:</div>
            {T_CAUSES.map(cause => cmdBtn(
              `${patient.reversibleCauseIdentified && patient.reversibleCause === cause ? '✓ ' : ''}${REVERSIBLE_CAUSE_LABELS[cause]}`,
              () => onIdentifyCause(cause),
              'bg-purple-900/60 text-purple-300',
            ))}
            {patient.reversibleCauseIdentified && !patient.reversibleCauseTreated && (
              <>
                <div className="border-t border-gray-700 my-2" />
                {cmdBtn('Treat Identified Cause', onTreatCause, 'bg-green-900/60 text-green-300')}
              </>
            )}
          </>
        )}

        {activeTab === 'team' && (
          <>
            {cmdBtn('Switch Compressor', onRequestCompressorSwitch, 'bg-amber-900/60 text-amber-300')}
            {cmdBtn('Announce Cycle Status', onAnnounceCycle, 'bg-indigo-900/60 text-indigo-300')}
            {cmdBtn('Clear Room (Remove Non-Essential)', onClearRoom, 'bg-gray-800 text-gray-300')}
            <div className="border-t border-gray-700 my-2" />
            {!confirmTOD ? (
              <button
                onClick={() => setConfirmTOD(true)}
                className="w-full text-left text-xs px-3 py-2 rounded bg-red-900/40 text-red-400 hover:bg-red-900/60"
              >
                Call Time of Death
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-900/30 border border-red-800 rounded p-2"
              >
                <p className="text-[10px] text-red-300 mb-2">Are you sure? This will end the code.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onCallTimeOfDeath(); setConfirmTOD(false); }}
                    className="text-[10px] px-3 py-1 rounded bg-red-800 text-red-200 hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmTOD(false)}
                    className="text-[10px] px-3 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
