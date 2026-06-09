import { useRef, useEffect } from 'react';
import { ClerkProvider, Show, useClerk, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter } from 'wouter';
import { useQueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import StartScreen from './components/game/StartScreen';
import BriefingScreen from './components/game/BriefingScreen';
import GameScreen from './components/game/GameScreen';
import DebriefScreen from './components/game/DebriefScreen';
import DevScorePanel from './components/game/DevScorePanel';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import { useGameEngine } from './engine/useGameEngine';
import { isDevMode } from './engine/devMode';

const DEV_MODE = isDevMode();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#ef4444",
    colorForeground: "#f1f5f9",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#0f172a",
    colorInput: "#1e293b",
    colorInputForeground: "#f1f5f9",
    colorNeutral: "#334155",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-gray-900 border border-gray-800 rounded-xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-100 font-bold",
    headerSubtitle: "text-gray-400",
    socialButtonsBlockButtonText: "text-gray-200",
    formFieldLabel: "text-gray-400 text-xs font-mono tracking-wider uppercase",
    footerActionLink: "text-red-400 hover:text-red-300",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-600",
    identityPreviewEditButton: "text-red-400",
    formFieldSuccessText: "text-green-400",
    alertText: "text-gray-200",
    logoBox: "justify-center",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border border-gray-700 bg-gray-800 hover:bg-gray-700",
    formButtonPrimary: "bg-red-700 hover:bg-red-600 font-bold tracking-wider",
    formFieldInput: "bg-gray-800 border-gray-700 text-gray-100",
    footerAction: "bg-transparent",
    dividerLine: "bg-gray-800",
    alert: "bg-gray-800 border-gray-700",
    otpCodeFieldInput: "bg-gray-800 border-gray-700 text-gray-100",
    formFieldRow: "",
    main: "",
  },
};

function DevRestartButton({ onRestart }: { onRestart: () => void }) {
  return (
    <button
      onClick={onRestart}
      title="DEV: Return to start screen"
      className="fixed bottom-3 right-3 z-50 px-2 py-1 rounded text-[10px] font-mono font-bold bg-gray-900 border border-gray-700 text-gray-500 hover:border-red-700 hover:text-red-400 hover:bg-red-950/40 transition-colors"
    >
      DEV ↺
    </button>
  );
}

function ClerkTokenWirer() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken, isSignedIn]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function SimulationApp() {
  const { ui, phase, actions, scenarioInput, rawState } = useGameEngine();

  if (phase === 'menu' || !ui || !scenarioInput) {
    return <StartScreen onStart={actions.startGame} />;
  }

  if (phase === 'briefing') {
    return (
      <>
        <BriefingScreen scenarioInput={scenarioInput} onBegin={actions.beginCode} />
        <DevRestartButton onRestart={actions.resetToMenu} />
      </>
    );
  }

  if (phase === 'debrief') {
    return (
      <>
        <DebriefScreen ui={ui} scenarioInput={scenarioInput} onNewGame={() => actions.startGame()} />
        <DevRestartButton onRestart={actions.resetToMenu} />
      </>
    );
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
        <DevRestartButton onRestart={actions.resetToMenu} />
      </div>
    );
  }

  return (
    <>
      <GameScreen ui={ui} scenarioInput={scenarioInput} actions={actions} />
      {DEV_MODE && rawState && phase === 'active' && (
        <DevScorePanel
          replay={rawState.replay}
          scenario={rawState.scenario}
          clock={rawState.clock}
        />
      )}
      <DevRestartButton onRestart={actions.resetToMenu} />
    </>
  );
}

function HomePage() {
  return (
    <>
      <Show when="signed-in">
        <SimulationApp />
      </Show>
      <Show when="signed-out">
        <SimulationApp />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to save your preferences across devices",
          },
        },
        signUp: {
          start: {
            title: "Create account",
            subtitle: "Save your preferences across devices",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkTokenWirer />
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
