import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UIState } from '../../engine/ui/uiStateEngine';

interface VitalsMonitorProps {
  ui: UIState;
}

function vitalColor(value: number, lo: number, hi: number): string {
  if (value === 0) return 'text-red-500';
  if (value < lo || value > hi) return 'text-yellow-300';
  return 'text-green-300';
}

export default function VitalsMonitor({ ui }: VitalsMonitorProps) {
  const [open, setOpen] = useState(true);
  const { vitals, rhythm, pulsePresent } = ui;

  return (
    <div className="bg-black border border-gray-800 rounded-lg overflow-hidden font-mono text-xs backdrop-blur-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-900/60 transition-colors"
      >
        <span className="text-gray-500 text-[10px] tracking-widest">MONITOR</span>
        <div className="flex items-center gap-1.5">
          <span className="text-amber-300 text-[10px]">
            {rhythm.toUpperCase()}{pulsePresent ? ' • PULSE' : ''}
          </span>
          <span className="text-gray-600 text-[10px]">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-1">
              <Row label="HR"   value={Math.round(vitals.hr)}  unit="bpm"  color={vitalColor(vitals.hr, 60, 100)} />
              <Row
                label="BP"
                value={`${Math.round(vitals.sysBP)}/${Math.round(vitals.diaBP)}`}
                unit="mmHg"
                color={vitalColor(vitals.sysBP, 90, 160)}
              />
              <Row label="SpO2"  value={Math.round(vitals.spo2)}  unit="%"    color={vitalColor(vitals.spo2, 92, 100)} />
              <Row label="EtCO2" value={Math.round(vitals.etco2)} unit="mmHg" color={vitalColor(vitals.etco2, 25, 45)} />
              <div className="mt-2 h-8 bg-gray-900/60 rounded relative overflow-hidden">
                <Sparkline values={vitals.etco2Trend} max={50} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, unit, color }: { label: string; value: number | string; unit: string; color: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-gray-900/60 pb-0.5">
      <span className="text-gray-600 text-[10px]">{label}</span>
      <span className={`font-bold ${color}`}>
        {value}
        <span className="text-gray-600 text-[9px] ml-1">{unit}</span>
      </span>
    </div>
  );
}

function Sparkline({ values, max }: { values: number[]; max: number }) {
  if (values.length === 0) return null;
  const w = 100;
  const h = 32;
  const step = w / Math.max(1, values.length - 1);
  let path = '';
  values.forEach((v, i) => {
    const x = i * step;
    const y = h - (Math.min(max, v) / max) * h;
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
      <path d={path} stroke="#fbbf24" strokeWidth="1" fill="none" />
    </svg>
  );
}
