# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/code-sim` (`@workspace/code-sim`)

Interactive ACLS (Advanced Cardiac Life Support) code simulation per **CODE_BLUE_MASTER_SPEC_v1**. Entirely frontend — no backend API needed.

- **Framework**: React + Vite + Tailwind CSS v4 + framer-motion
- **Architecture**: Modular engine, fully deterministic. UI components are dumb selectors over `UIState`.
- **Determinism**: Single seeded PRNG (mulberry32 + fnv1a string hash) in `src/engine/rng.ts`. **Zero `Math.random` calls in `src/engine`** — enforced by a guard test.
- **Engine modules** (`src/engine/`):
  - `rng.ts` — fnv1a + mulberry32 (`draw`, `drawInt`, `drawChoice`)
  - `clock.ts` — fixed-step accumulator (`STEP_SECONDS = 0.1`)
  - `clinical/aclsConstants.ts` — salvaged ACLS constants
  - `types/` — pure type modules (core, scenario, rhythm, physiology, team, orders, clinical, replay, score, state, actions)
  - `replay/replayEngine.ts` — append-only `ReplayEvent[]` (typed dotted eventTypes; never string-grepped)
  - `scenario/witnessedVfArrest.ts` + `scenario/scenarioEngine.ts` — single scenario `witnessed_vf_rosc_v1`, with two scripted chaos events: `compressor_fatigue` (random 60–120s) and `medication_delay` (fires on first medication order, +35s)
  - `rhythm/rhythmEngine.ts` — deterministic rhythm transitions including ROSC probability after shocks
  - `physiology/physiologyEngine.ts` — vitals, EtCO2, perfusion (deterministic; no RNG calls during tick)
  - `team/{archetypes,teamEngine}.ts` — 8 archetypes; team initialized from scenario; CONFIRM closes the loop on a role
  - `orders/pendingOrdersEngine.ts` — orders pre-schedule their entire timeline at issuance (`scheduleOrder` computes heardAt/acknowledgedAt/inProgressAt/terminalAt + plannedOutcome). Tick only promotes status — no RNG consumed in tick. Terminal `OrderStatus` includes `completed | missed | failed | delayed | wrong_recipient`; `isTerminal()` exported helper.
  - `scoring/schemeE.ts` — Scheme E with 5 buckets totaling 100, each with an `arithmetic` string. `effectiveCompletions(events)` helper treats `pendingOrder.completed` and `pendingOrder.delayed` as successful for clinical lookups; `pendingOrder.wrong_recipient` is counted separately as an assignment penalty:
    - ACLS Timing (15) · CPR Continuity (20) · Defibrillation & Medication Protocol (15) · Delegation & Closed-Loop (25) · Leadership Under Chaos (25)
  - `ui/uiStateEngine.ts` — `selectUIState()` produces a view-model consumed by all React components
  - `replay/replayFormatter.ts` — `formatEvent`, `formatEvents`, `formatEventsAsText`, `formatClock` for text export of `ReplayEvent[]` (dedicated formatter; UI's `EventLog` keeps its rich rendering for in-game display).
  - `index.ts` — composite `initSimulationState`, `startSimulation`, `tickOnce`, `dispatchUserAction`, `finalizeAndScore`, plus headless **`replay(seed, ScheduledAction[], options?) -> ReplayEvent[]`** API for deterministic re-runs / golden-trace tests.
  - `useGameEngine.ts` — React hook with `requestAnimationFrame` loop and fixed-step accumulator
- **ScoreReport shape**: `{ total, generatedAt, aclsTiming, cprContinuity, defibMed, delegationClc, leadershipChaos, buckets[], arithmetic: Record<id,string>, strengths: string[], misses: string[], teachingPoints: string[] }`. Each named bucket is a `ScoreBucket { id, label, max, awarded, arithmetic, reasons }`.
- **ROSC gating**: `dispatch_user_action({kind:'declare_rosc'})` only ends the scenario when the current rhythm is perfusing AND `pulsePresent`. Otherwise it appends `user.declare_rosc` (with `valid:false`) and `system.rosc_declaration_rejected` and the simulation continues.
- **UI components** (`src/components/game/`): `StartScreen` (with mandatory **EDUCATIONAL USE ONLY** disclaimer above the scenario card), `BriefingScreen`, `GameScreen`, `VitalsMonitor`, `StopwatchWidget`, `TeamPanel` (with CONFIRM buttons), `LiveRoomCanvas`, `CommandPanel`, `PendingOrdersPanel`, `EventLog`, `ReplayTimeline`, `DebriefScreen`.
- **CommandPanel — exactly the §12 MVP action set** (single grid, no tabs, no H&Ts): Start CPR · Assign Compressor · Rotate Compressor · Charge Defib · SHOCK · Give Epinephrine 1mg · Give Amiodarone (300mg→150mg) · Rhythm Check · Pulse Check · Manage Airway · Ask for closed-loop confirmation (targets the most recent open order). Out-of-scope controls (Hold CPR, Announce Cycle, Declare ROSC button, Call Time of Death button, separate IV/IO/BVM/advanced-airway buttons, lidocaine/bicarb/calcium/magnesium, the END & DEBRIEF header shortcut, and per-order CLC quick-action) have been removed.
- **Engine action surface boundary**: `EngineActions` interface (`useGameEngine.ts`) splits methods into the §12 MVP subset (UI-facing) vs `@internal` JSDoc-tagged methods (`pauseCpr`, `ivAccess`, `ioAccess`, `airwayAdvanced`, `announceCycle`, `declareRosc`, `callTimeOfDeath`) retained only for the headless `replay()` API and scripted tests.
- **PendingOrders display**: `selectUIState()` keeps terminal orders (`completed | delayed | wrong_recipient | failed | missed`) visible for `TERMINAL_DISPLAY_SECONDS = 5` after their `terminalAt` so the queue-advancement UX shows the final state before fading out.
- **Game flow**: Menu → Briefing → Active → Debrief. Real-time budget 5–8 minutes (300–480s). The scenario ends via budget timeout, via auto-ROSC (the engine emits `system.rosc_detected` and auto-finalizes with `outcome='rosc'` whenever a shock produces a perfusing rhythm with pulse — the §12 UI has no manual ROSC button), or via the gated `declare_rosc` / `call_time_of_death` engine actions (still available to the headless `replay()` API and tests).
- **Scheme E leadership scoring (Leadership Under Chaos, max 25)**: rhythm-check cadence (max 5, in-UI signal — replaces the prior out-of-UI `announce_cycle` count) + chaos response (max 10) + decision/outcome (max 10).
- **Tests** (`src/engine/__tests__/run.ts`, run with `pnpm --filter @workspace/code-sim run test`): Math.random guard, determinism, golden-trace event types, Scheme E bucket math, well-formed arithmetic strings, empty-replay floor, chaos firing windows, premature-ROSC rejection, `ScoreReport` named-bucket shape + narrative, `replay()` API determinism, `formatEvent` text format, shock-induced auto-ROSC reachable via §12 UI actions only. **13/13 passing.**

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
