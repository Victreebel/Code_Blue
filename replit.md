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

Interactive ACLS (Advanced Cardiac Life Support) code simulation game for resident physicians. Entirely frontend — no backend API needed.

- **Framework**: React + Vite + Tailwind CSS v4
- **Animation**: framer-motion
- **Architecture**: Game engine with `useReducer` pattern
  - `src/engine/types.ts` — All game types, enums, labels
  - `src/engine/aclsProtocol.ts` — ACLS protocol logic (rhythms, vitals, medication rules)
  - `src/engine/scenarioGenerator.ts` — Random scenario generation (patients, teams, complications)
  - `src/engine/teamAI.ts` — AI team member behaviors (self-assignment, speech, complication handling)
  - `src/engine/scoringEngine.ts` — ACLS adherence scoring with grade calculation
  - `src/engine/gameReducer.ts` — Central game state reducer
  - `src/engine/useGameEngine.ts` — React hook wrapping reducer + game loop
- **UI Components** (`src/components/game/`):
  - `StartScreen.tsx` — Difficulty selection, seed scenario picker, instructions
  - `BriefingScreen.tsx` — Patient briefing before code begins
  - `GameScreen.tsx` — Main game with vitals, room canvas, team panel, commands, event log
  - `DebriefScreen.tsx` — Post-game scoring, replay timeline, action review
  - `VitalsMonitor.tsx` — ECG canvas + vital signs display
  - `TeamPanel.tsx` — NPC team members with role assignment
  - `CommandPanel.tsx` — Tabbed order interface (CPR/Defib, Meds, Airway/IV, H's&T's, Team/Other)
  - `EventLog.tsx` — Scrolling event timeline
  - `StopwatchWidget.tsx` — Manual stopwatch for timing
  - `LiveRoomCanvas.tsx` — SVG room visualization with staff positions, CPR animation, speech bubbles, chaos meter
  - `PendingOrdersPanel.tsx` — Pending order lifecycle display (issued→heard→ack→in_progress→completed/failed)
  - `ReplayTimeline.tsx` — Color-coded event replay timeline in debrief with filters
- **PendingOrder System**: Medications and IV/IO orders create pending orders that progress through lifecycle stages (issued→heard→acknowledged→in_progress→completed/failed/missed). Staff competence affects success rate. Rich failure modes: `wrong_person`, `prerequisite_missing`, `duplicate`, `abandoned`, `timeout`, `no_access`.
- **Staff Archetypes** (`staffArchetypes.ts`): 8 behavior archetypes (experienced_nurse, hesitant_new_nurse, reliable_rt, delayed_rt, eager_intern, distractible_intern, efficient_pharmacist, interfering_senior) with unique BehaviorProfile traits, speech banks, delay patterns, clarification phrases, and wrong-task events.
- **Physiology Realism** (`aclsProtocol.ts`): `computePhysiology()` calculates perfusionIndex, oxygenationIndex, roscProbability based on CPR quality, epinephrine timing, airway status, and reversible cause treatment. EtCO2 trend tracking.
- **Compressor Fatigue**: CPR quality degrades over time when the same person compresses. Fatigue resets on compressor switch.
- **Chaos Meter**: Real-time chaos level calculated from overcrowding, unassigned roles, CPR gaps, failed orders, complications.
- **Compression Fraction HUD**: Tracks total CPR time vs total code time.
- **Defibrillator Workflow**: Must charge defibrillator (200J) before shock can be delivered. Charge resets after each shock.
- **New Team Actions**: Switch compressor, announce cycle status, clear room of non-essential personnel.
- **Pulse Check Mechanic**: Player must explicitly check for a pulse to confirm ROSC (not auto-detected). Organized rhythms prompt "CHECK PULSE" reminders. Inappropriate pulse checks on shockable/asystole rhythms incur a -5 penalty. 10-second cooldown between checks.
- **Seed Scenarios**: 3 predetermined scenarios for consistent testing: VF/ROSC, PEA/Hypoxia, Asystole/Overcrowded
- **Game Flow**: Menu → Briefing → Active Code → Ended → Debrief → Menu
- **Difficulty levels**: Intern (easy), Resident (medium), Attending (hard)
- **Scoring**: 10 categories (rhythmCheckTiming, epinephrineTiming, defibrillationTiming, medicationChoices, pulseChecks, closedLoopComm, teamManagement, reversibleCauses, overallLeadership, roomControl) totaling 102 max + penalties. Room control has 5 sub-dimensions.
- **Debrief Intelligence** (`scoringEngine.ts`): `generateDebriefAnalysis()` produces playerImpact rating, topMistakes/topStrengths with impact descriptions, primaryFailureDomain classification, and roomControlBreakdown (roleClarity, crowdControl, assignmentFollowThrough, ambiguityCorrection, delayRecovery).
- **UI Priority Hierarchy**: Protocol reminders are priority-sorted; the most urgent reminder is visually dominant while secondary alerts are de-emphasized.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
