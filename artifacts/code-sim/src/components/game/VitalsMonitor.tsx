import { useEffect, useRef, useState } from 'react';
import { type PatientState, type Rhythm, RHYTHM_LABELS, ROSC_RHYTHMS } from '../../engine/types';
import { formatTime } from '../../engine/gameReducer';
import { motion, AnimatePresence } from 'framer-motion';

interface VitalsMonitorProps {
  patient: PatientState;
  clock: number;
}

const ECG_PATTERNS: Record<Rhythm, number[]> = {
  vfib: [0, 3, -2, 5, -4, 6, -3, 2, -5, 4, -1, 3, -6, 5, -2, 4, -3, 1, -4, 6],
  vtach: [0, 0, 8, -2, 0, 0, 0, 0, 8, -2, 0, 0, 0, 0, 8, -2, 0, 0, 0, 0],
  pea: [0, 0, 0, 1, 5, -1, 2, 0, 0, 0, 0, 0, 0, 1, 5, -1, 2, 0, 0, 0],
  asystole: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  sinus: [0, 0, 1, 2, 0, -1, 0, 8, -2, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0],
  sinus_brady: [0, 0, 0, 1, 2, 0, -1, 0, 8, -2, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0],
  sinus_tachy: [0, 1, 2, 0, 8, -2, 0, 1, 0, 1, 2, 0, 8, -2, 0, 1, 0, 0, 0, 0],
};

function ECGWaveform({ rhythm, clock }: { rhythm: Rhythm; clock: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patternRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;

    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#0f2a1a';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const pattern = ECG_PATTERNS[rhythm];
    const noise = rhythm === 'vfib' ? 3 : rhythm === 'asystole' ? 0.3 : 0.5;
    const speed = rhythm === 'vfib' ? 4 : rhythm === 'sinus_tachy' ? 3 : 2;

    ctx.strokeStyle = ROSC_RHYTHMS.includes(rhythm) ? '#00ff88' : '#00ff44';
    ctx.lineWidth = 2;
    ctx.shadowColor = ROSC_RHYTHMS.includes(rhythm) ? '#00ff88' : '#00ff44';
    ctx.shadowBlur = 4;
    ctx.beginPath();

    const offset = (clock * speed * 10) % pattern.length;
    for (let x = 0; x < w; x++) {
      const idx = (x / 8 + offset) % pattern.length;
      const i = Math.floor(idx);
      const frac = idx - i;
      const a = pattern[i % pattern.length];
      const b = pattern[(i + 1) % pattern.length];
      const val = a + (b - a) * frac;
      const y = mid - val * 6 + (Math.random() - 0.5) * noise;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [rhythm, clock]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={80}
      className="w-full rounded border border-green-900/50"
    />
  );
}

export default function VitalsMonitor({ patient, clock }: VitalsMonitorProps) {
  const isArrest = !ROSC_RHYTHMS.includes(patient.rhythm);
  const [flashHR, setFlashHR] = useState(false);

  useEffect(() => {
    if (isArrest) {
      const interval = setInterval(() => setFlashHR(v => !v), 800);
      return () => clearInterval(interval);
    }
    setFlashHR(false);
    return undefined;
  }, [isArrest]);

  return (
    <div className="bg-[#0a0e14] rounded-lg border border-gray-700 p-3 font-mono text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-green-400 text-xs font-bold tracking-wider">BEDSIDE MONITOR</span>
        <span className="text-gray-500 text-xs">{formatTime(clock)}</span>
      </div>

      <ECGWaveform rhythm={patient.rhythm} clock={clock} />

      <div className="mt-2 text-xs text-gray-400">
        {RHYTHM_LABELS[patient.rhythm]}
        {patient.cprInProgress && (
          <motion.span
            className="ml-2 text-yellow-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            CPR IN PROGRESS
          </motion.span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3">
        <div className="text-center">
          <div className="text-gray-500 text-[10px]">HR</div>
          <motion.div
            className={`text-xl font-bold ${isArrest ? (flashHR ? 'text-red-500' : 'text-red-900') : 'text-green-400'}`}
            animate={isArrest ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            {patient.hr}
          </motion.div>
          <div className="text-gray-600 text-[10px]">bpm</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-[10px]">BP</div>
          <div className={`text-xl font-bold ${patient.bp.systolic === 0 ? 'text-red-500' : 'text-blue-400'}`}>
            {patient.bp.systolic}/{patient.bp.diastolic}
          </div>
          <div className="text-gray-600 text-[10px]">mmHg</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-[10px]">SpO2</div>
          <div className={`text-xl font-bold ${patient.spo2 < 90 ? 'text-red-400' : patient.spo2 < 95 ? 'text-yellow-400' : 'text-cyan-400'}`}>
            {patient.spo2}
          </div>
          <div className="text-gray-600 text-[10px]">%</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-[10px]">EtCO2</div>
          <div className={`text-xl font-bold ${patient.etco2 < 10 ? 'text-red-400' : patient.etco2 < 20 ? 'text-yellow-400' : 'text-purple-400'}`}>
            {patient.etco2}
          </div>
          <div className="text-gray-600 text-[10px]">mmHg</div>
        </div>
      </div>

      <div className="flex gap-2 mt-2 text-[10px]">
        {patient.hasIV && <span className="bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">IV</span>}
        {patient.hasIO && <span className="bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">IO</span>}
        {patient.hasAdvancedAirway && <span className="bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded">ETT</span>}
        <span className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">Shocks: {patient.shockCount}</span>
        <span className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">Epi: {patient.medications.filter(m => m.type === 'epinephrine').length}</span>
      </div>
    </div>
  );
}
