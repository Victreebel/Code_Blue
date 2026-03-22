import StartScreen from './components/game/StartScreen';
import BriefingScreen from './components/game/BriefingScreen';
import GameScreen from './components/game/GameScreen';
import DebriefScreen from './components/game/DebriefScreen';
import { useGameEngine } from './engine/useGameEngine';

function App() {
  const { state, actions } = useGameEngine();
  const lastDifficulty = state.scenario?.difficulty ?? 'medium';

  if (state.phase === 'menu') {
    return <StartScreen onStart={actions.startGame} />;
  }

  if (state.phase === 'briefing') {
    if (!state.scenario) {
      return <StartScreen onStart={actions.startGame} />;
    }
    return <BriefingScreen scenario={state.scenario} onBegin={actions.beginCode} />;
  }

  if (state.phase === 'debrief') {
    return (
      <DebriefScreen
        state={state}
        onNewGame={() => actions.startGame(lastDifficulty)}
      />
    );
  }

  if (state.phase === 'ended') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-200 mb-4">Code Complete</h2>
          <p className="text-gray-400 mb-6 text-sm">
            {state.actionLog.find(l => l.action.includes('ROSC'))
              ? 'ROSC was achieved. Well done.'
              : state.actionLog.find(l => l.action.includes('Time of death'))
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
              onClick={() => actions.startGame(lastDifficulty)}
              className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700"
            >
              New Code
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <GameScreen state={state} actions={actions} />;
}

export default App;
