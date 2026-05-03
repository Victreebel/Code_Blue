# Code Blue — ACLS Code Simulator

A browser-based, leadership-focused ACLS code simulation. You play the code leader of a witnessed cardiac arrest, direct your team in real time, and receive a structured debrief at the end.

> **Educational use only.** This is a training and learning simulation. It is **not** a medical device, is not a substitute for professional ACLS certification or clinical judgment, and must not be used to direct real patient care. Clinical thresholds, timings, and outcomes are simplified for teaching and may differ from current AHA guidelines.

## What's inside

This is a pnpm monorepo with three artifacts:

| Path | Purpose |
|---|---|
| `artifacts/code-sim` | The ACLS simulator — React + Vite web app. The main product. |
| `artifacts/api-server` | Supporting API server (Node). |
| `artifacts/mockup-sandbox` | Internal component-preview workspace used for design iteration. |

The simulator's deterministic engine lives in `artifacts/code-sim/src/engine/` and is fully covered by unit tests (golden trace, determinism, scoring shape, chaos windows, replay API).

## Requirements

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)

## Getting started

```bash
pnpm install
pnpm --filter @workspace/code-sim run dev
```

The simulator will be available at the URL Vite prints (typically `http://localhost:5173`).

## Running tests

```bash
pnpm --filter @workspace/code-sim run test
```

The engine test suite enforces determinism, scoring correctness, and the absence of `Math.random` from engine code.

## Project structure (simulator)

```
artifacts/code-sim/src/
├── engine/                  Pure deterministic simulation core
│   ├── scenario/            Scenario definition + state engine
│   ├── rhythm/              Rhythm transitions
│   ├── physiology/          Vitals model
│   ├── team/                Team behavior + archetypes
│   ├── orders/              Order lifecycle (issued → completed)
│   ├── scoring/             Scheme E scoring (5 buckets, 100 pts)
│   ├── ui/                  UI state projection
│   ├── clinical/            ACLS constants
│   └── types/               Shared types
└── components/game/         React UI (Start, Briefing, Game, Debrief)
```

## How a session works

1. **Start screen** — read the disclaimer, optionally enter a seed for reproducible runs, click **Run Code**.
2. **Briefing** — patient summary and scenario context.
3. **Live code** — direct your team in real time using the 11-button command panel (CPR, defibrillation, medications, rhythm/pulse checks, airway, closed-loop confirmation).
4. **Debrief** — structured 5-bucket score with explicit arithmetic and reasons for every point awarded or missed.

## Determinism & replay

The engine is fully deterministic. Given the same seed and the same sequence of player actions, the simulation produces an identical event trace. A `replay(seed, actions[])` API is exported for testing and reproducibility.

## Contributing / multi-tool workflow

This repo is set up to be edited from multiple environments (Replit, Cursor, ChatGPT). The golden rule:

**Always `git pull` before you start editing, and `git push` when you're done.**

GitHub is the source of truth — every other tool reads from and writes to it.

## License

TBD.
