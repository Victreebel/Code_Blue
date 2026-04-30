import StartScreen from './components/game/StartScreen';
import BriefingScreen from './components/game/BriefingScreen';
import GameScreen from './components/game/GameScreen';
import DebriefScreen from './components/game/DebriefScreen';
import { useGameEngine } from './engine/useGameEngine';

function App() {
  const { ui, phase, actions, scenarioInput } = useGameEngine();

  if (phase === 'menu' || !ui || !scenarioInput) {
    return <StartScreen onStart={actions.startGame} />;
  }

  if (phase === 'briefing') {
    return <BriefingScreen scenarioInput={scenarioInput} onBegin={actions.beginCode} />;
  }

  if (phase === 'debrief') {
    return <DebriefScreen ui={ui} scenarioInput={scenarioInput} onNewGame={() => actions.startGame()} />;
  }

  if (phase === 'ended') {
    const wasRosc = ui.outcome === 'rosc';
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-200 mb-4">Code Complete</h2>
          <p className="text-gray-400 mb-6 text-sm">
            {wasRosc
              ? 'ROSC was achieved. Well done.'
              : ui.outcome === 'time_of_death'
                ? 'Time of death was called.'
                : 'The code has ended.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={actions.viewDebrief}
              className="px-6 py-2 rounded-lg bg-blue-700 text-white text-sm hover:bg-blue-600"
            >
              View Debrief
            </button>
            <button
              onClick={() => actions.startGame()}
              className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700"
            >
              New Code
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <GameScreen ui={ui} scenarioInput={scenarioInput} actions={actions} />;
}

export default App;
