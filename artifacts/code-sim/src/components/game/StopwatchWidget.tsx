import { type StopwatchState } from '../../engine/types';
import { formatTime } from '../../engine/gameReducer';

interface StopwatchWidgetProps {
  stopwatch: StopwatchState;
  onToggle: () => void;
  onReset: () => void;
}

export default function StopwatchWidget({ stopwatch, onToggle, onReset }: StopwatchWidgetProps) {
  return (
    <div className="bg-gray-900/90 rounded-lg border border-gray-700 p-3">
      <h3 className="text-xs font-bold text-gray-300 tracking-wider mb-2">STOPWATCH</h3>
      <div className="text-center">
        <div className={`text-2xl font-mono font-bold ${stopwatch.running ? 'text-green-400' : 'text-gray-400'}`}>
          {formatTime(stopwatch.elapsed)}
        </div>
        <div className="flex gap-2 mt-2 justify-center">
          <button
            onClick={onToggle}
            className={`text-xs px-3 py-1 rounded ${
              stopwatch.running
                ? 'bg-yellow-900/60 text-yellow-300 hover:bg-yellow-800/70'
                : 'bg-green-900/60 text-green-300 hover:bg-green-800/70'
            }`}
          >
            {stopwatch.running ? 'Stop' : 'Start'}
          </button>
          <button
            onClick={onReset}
            className="text-xs px-3 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
