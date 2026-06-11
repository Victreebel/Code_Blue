# ACLS Code Simulation — Codebase Guide

> **Purpose:** This document gives an AI assistant (Claude, Codex, or similar) everything it needs to understand, navigate, and safely extend the ACLS Code Blue Simulator without breaking the engine or corrupting game state.

---

## 1. What This App Is

A browser-based medical training simulation for ACLS (Advanced Cardiovascular Life Support) resuscitation. The learner plays the **Code Leader** of a 6-person ICU team responding to a witnessed VF cardiac arrest. The simulation runs in real time (5–8 minutes), scores the learner on clinical protocol adherence, team delegation, and leadership under pressure, then generates a debrief report.

**Key educational goals:**
- CPR initiated within 30 s, maintained at ≥80% compression fraction
- First shock for VF within 2 minutes
- Rhythm checks on a 2-minute cadence
- Epinephrine every 3–5 minutes
- Amiodarone 300 mg → 150 mg after the 2nd shock
- Closed-loop communication for every order
- Role assignment + confirmation via verbal readback

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Package manager | pnpm (monorepo workspace) |
| 3D rendering | **Pure CSS 3D** — no Three.js, no WebGL |
| Auth | Clerk (dev keys; not required for game play) |
| State | `useReducer` + `useRef` — **no Redux, no Zustand** |

---

## 3. Directory Structure

```
artifacts/code-sim/
├── src/
│   ├── App.tsx                        # Route root; phase → screen switch
│   ├── engine/                        # All simulation logic (pure TS, no React)
│   │   ├── index.ts                   # Public engine API
│   │   ├── useGameEngine.ts           # React hook — glues engine to UI
│   │   ├── clock.ts                   # requestAnimationFrame accumulator
│   │   ├── rng.ts                     # Seeded RNG (FNV-1a)
│   │   ├── devMode.ts                 # Dev score panel helper
│   │   ├── clinical/
│   │   │   └── aclsConstants.ts       # All numeric ACLS thresholds
│   │   ├── orders/
│   │   │   └── pendingOrdersEngine.ts # Order lifecycle state machine
│   │   ├── physiology/
│   │   │   └── physiologyEngine.ts   # Vitals simulation
│   │   ├── replay/
│   │   │   ├── replayEngine.ts        # Event log append/query
│   │   │   └── replayFormatter.ts    # Human-readable event strings
│   │   ├── rhythm/
│   │   │   └── rhythmEngine.ts        # Rhythm transitions & pulse logic
│   │   ├── scenario/
│   │   │   ├── scenarioEngine.ts      # Chaos event firing, outcome detection
│   │   │   └── witnessedVfArrest.ts   # The one built-in scenario
│   │   ├── scoring/
│   │   │   └── schemeE.ts             # Scoring rubric (5 buckets, 100 pts)
│   │   ├── team/
│   │   │   ├── archetypes.ts          # 8 NPC personality archetypes
│   │   │   └── teamEngine.ts          # NPC AI tick
│   │   ├── ui/
│   │   │   └── uiStateEngine.ts       # Derives UIState from SimulationState
│   │   └── types/                     # All TypeScript interfaces/types
│   │       ├── actions.ts             # UserAction union type
│   │       ├── clinical.ts            # ClinicalState
│   │       ├── core.ts                # Rhythm, TeamRole, StaffType, etc.
│   │       ├── orders.ts              # PendingOrder
│   │       ├── physiology.ts          # PhysiologyState
│   │       ├── replay.ts              # ReplayEvent
│   │       ├── rhythm.ts              # RhythmState
│   │       ├── scenario.ts            # ScenarioInput, ScenarioState
│   │       ├── score.ts               # ScoreReport, ScoreBucket
│   │       ├── state.ts               # SimulationState (root)
│   │       └── team.ts                # TeamMemberRuntime
│   └── components/
│       └── game/
│           ├── GameScreen.tsx         # Active-play shell + HUD layout
│           ├── IsometricRoom.tsx      # Top-down isometric SVG room view
│           ├── FirstPersonRoom.tsx    # CSS 3D first-person room view
│           ├── VitalsMonitor.tsx      # Vitals HUD panel
│           ├── PendingOrdersPanel.tsx # Order queue HUD panel
│           ├── StopwatchWidget.tsx    # Clock/stopwatch HUD panel
│           ├── EventLog.tsx           # Replay event log HUD
│           ├── CommandPanel.tsx       # Order buttons (§12 MVP surface)
│           ├── TeamPanel.tsx          # Team role assignment panel
│           ├── BriefingScreen.tsx     # Pre-code briefing
│           ├── DebriefScreen.tsx      # Post-code score report
│           ├── StartScreen.tsx        # Landing page
│           └── LiveRoomCanvas.tsx     # (legacy/unused wrapper)
```

---

## 4. Game Flow

```
StartScreen  ──[RUN CODE]──►  BriefingScreen  ──[BEGIN CODE]──►  GameScreen (active)
                                                                        │
                                                           [View Debrief / Time Out / ROSC]
                                                                        ▼
                                                               DebriefScreen
                                                                        │
                                                                [Back to Menu]
                                                                        ▼
                                                                 StartScreen
```

**Phase values** (`SimulationState.phase`):
`'menu'` → `'briefing'` → `'active'` → `'ended'` → `'debrief'`

The game clock advances via `requestAnimationFrame` → `pollSteps()` → `tickOnce(state)` called once per simulated second. All engine functions are **pure** — `tickOnce` returns a new state object, never mutates.

---

## 5. Core Types

### SimulationState (root)
```ts
interface SimulationState {
  scenario:   ScenarioState;     // scenario metadata, chaos events, outcome
  rhythm:     RhythmState;       // current ECG rhythm, pulse present
  physiology: PhysiologyState;   // HR, BP, SpO2, EtCO2, perfusionIndex
  team:       TeamState;         // array of TeamMemberRuntime
  orders:     OrdersState;       // array of PendingOrder
  clinical:   ClinicalState;     // cprActive, defibCharged, shockCount, accesses, meds
  replay:     ReplayState;       // append-only event log
  score:      ScoreReport | null;
  clock:      number;            // seconds elapsed
  rng:        RngState;          // seeded random state
  phase:      Phase;
}
```

### UIState (derived, read-only, used by all React components)
Components never read `SimulationState` directly. They receive `UIState` from `selectUIState()`:
```ts
interface UIState {
  phase, clock, scenarioId, outcome,
  rhythmLabel, rhythm, pulsePresent,
  vitals: { hr, sysBP, diaBP, spo2, etco2, perfusionIndex, etco2Trend },
  cprActive, defibCharged, shockCount,
  hasIVAccess, hasIOAccess, hasAdvancedAirway,
  amiodaroneDoses, lastEpiAt, lastRhythmCheckAt,
  team: TeamMemberRuntime[],
  pendingOrders: PendingOrder[],
  recentLog: ReplayEvent[],
  chaosFiredCount,
  scoreReport,
}
```

### TeamMemberRuntime
```ts
interface TeamMemberRuntime {
  id: string;
  name: string;
  staffType: StaffType;        // 'nurse'|'resident'|'attending'|'rt'|'tech'|'student'|'pharmacist'
  archetypeId: StaffArchetypeId;
  competence: 'low'|'medium'|'high';
  compliance: 'cooperative'|'independent'|'resistant';
  behavior: BehaviorProfile;   // 5 floats: initiative, distractibility, etc.
  isLeader: boolean;           // leader is YOU — excluded from 3D rendering
  assignedRole: TeamRole;      // see TeamRole below
  confirmedRole: boolean;      // true after closed-loop confirmation
  inRoom: boolean;
  busyUntil: number;           // clock second when this member is free
  fatigueLevel: number;        // 0–1; >0.5 dims the figure
  speech: { text: string; until: number } | null;
  currentOrderId: string | null;
}
```

### TeamRole (all possible values)
```
'leader' | 'compressor' | 'airway' | 'iv_access' | 'medication'
| 'monitor_defib' | 'recorder' | 'timekeeper' | 'none'
```

### Rhythm (all possible values)
```
'vfib' | 'vtach' | 'pea' | 'asystole' | 'sinus' | 'sinus_brady' | 'sinus_tachy'
```
Shockable: `vfib`, `vtach`. Non-shockable arrest: `pea`, `asystole`. ROSC: `sinus*`.

---

## 6. Actions

All learner interactions dispatch a `UserAction`:
```ts
type UserAction =
  | { kind: 'assign_role'; memberId: string; role: TeamRole }
  | { kind: 'confirm_role'; memberId: string }
  | { kind: 'assign_compressor' }
  | { kind: 'order_cpr_start' }
  | { kind: 'order_cpr_pause' }
  | { kind: 'order_rhythm_check' }
  | { kind: 'order_pulse_check' }
  | { kind: 'order_charge_defib' }
  | { kind: 'order_shock' }
  | { kind: 'order_iv_access' }
  | { kind: 'order_io_access' }
  | { kind: 'order_airway_bvm' }
  | { kind: 'order_airway_advanced' }
  | { kind: 'order_medication'; medication: MedicationType; doseMg: number }
  | { kind: 'order_compressor_switch'; toMemberId?: string }
  | { kind: 'order_announce_cycle' }
  | { kind: 'request_closed_loop'; orderId: string }
  | { kind: 'call_time_of_death' }
  | { kind: 'declare_rosc' }
```

**The `EngineActions` interface** (from `useGameEngine.ts`) wraps these in named methods and is the only thing React components call. Never call `dispatchUserAction` directly from a component.

**§12 MVP surface** — actions exposed in the active UI:
`startCpr`, `switchCompressor`, `chargeDefib`, `shock`, `medication`, `rhythmCheck`, `pulseCheck`, `airwayBvm`, `requestClosedLoop`, `assignRole`, `confirmRole`

**@internal** (engine/test only, not in UI):
`pauseCpr`, `ivAccess`, `ioAccess`, `airwayAdvanced`, `announceCycle`, `declareRosc`, `callTimeOfDeath`

---

## 7. ACLS Clinical Constants

All in `src/engine/clinical/aclsConstants.ts`:

| Constant | Value | Meaning |
|---|---|---|
| `RHYTHM_CHECK_INTERVAL_SECONDS` | 120 | Target cadence between rhythm checks |
| `RHYTHM_CHECK_GRACE_SECONDS` | 10 | Allowed deviation before scoring penalty |
| `EPI_MIN_INTERVAL_SECONDS` | 180 | Minimum epi re-dose interval (3 min) |
| `EPI_MAX_INTERVAL_SECONDS` | 300 | Maximum epi re-dose interval (5 min) |
| `AMIODARONE_FIRST_DOSE_MG` | 300 | First amiodarone dose |
| `AMIODARONE_SUBSEQUENT_DOSE_MG` | 150 | Subsequent amiodarone dose |
| `CPR_CYCLE_DURATION` | 120 | Seconds before compressor swap prompt |
| `SHOCK_JOULES` | 200 | Biphasic energy for all shocks |
| `COMPRESSOR_SWAP_INTERVAL` | 120 | Seconds between expected compressor rotations |

---

## 8. Scoring Rubric (Scheme E — 100 points total)

| Bucket | Max | Key criteria |
|---|---|---|
| **ACLS Timing** | 15 | CPR ≤30 s (5 pts), 1st shock ≤2 min (5 pts), rhythm-check cadence (5 pts) |
| **CPR Continuity** | 20 | Compression fraction ≥80% (12 pts), pause discipline <10 s (4 pts), compressor swaps (4 pts) |
| **Defibrillation & Medication** | 15 | Shock energy 200J (5 pts), epi cadence 3–5 min (5 pts), amiodarone correct doses (5 pts) |
| **Delegation & Closed-Loop** | 25 | Role assignment accuracy (8 pts), order delivery rate (9 pts), CLC readbacks + confirmations (8 pts) |
| **Leadership Under Chaos** | 25 | Rhythm-check cadence score (5 pts), chaos response within 30 s (10 pts), outcome decision (10 pts) |

Scoring logic lives entirely in `src/engine/scoring/schemeE.ts`. The debrief screen (`DebriefScreen.tsx`) renders `ScoreReport` which includes per-bucket arithmetic, strengths, misses, and teaching points.

---

## 9. Scenario: Witnessed VF Arrest

File: `src/engine/scenario/witnessedVfArrest.ts`

**Patient:** James O'Neill, 58 M, 86 kg, PMH HTN/hyperlipidemia/NSTEMI 2024 (LAD stent). On heparin, witnessed VF arrest.

**Initial rhythm:** `vfib`

**Budget:** 300–480 real seconds (5–8 min)

**Team (6 members):**
| ID | Name | StaffType | Initial Role | Archetype |
|---|---|---|---|---|
| `leader` | YOU | attending | leader | reliable_rt |
| `rn_primary` | Sara (Charge RN) | nurse | medication | experienced_nurse |
| `rn_new` | Megan (RN, 6 mo) | nurse | recorder | hesitant_new_nurse |
| `resident` | Dr. Patel (PGY-2) | resident | compressor | eager_intern |
| `rt` | Tom (RT) | rt | airway | reliable_rt |
| `tech` | Alex (PCT) | tech | monitor_defib | distractible_intern |

**Chaos events (2 scripted):**
1. `compressor_fatigue` — fires at a random time between 60–120 s. Learner must order `switchCompressor` within 30 s for credit.
2. `medication_delay` — fires on the first medication order. Learner must request closed-loop confirmation within 30 s for credit.

---

## 10. NPC Archetypes

8 archetypes defined in `src/engine/team/archetypes.ts`. Each defines behavior floats (0–1), preferred roles, and phrase banks:

| ID | Label | Key traits |
|---|---|---|
| `experienced_nurse` | Experienced Bedside Nurse | High initiative, fast execution, proactive |
| `hesitant_new_nurse` | Hesitant New Nurse | Low initiative, high clarification tendency, slow |
| `reliable_rt` | Reliable RT | Focused, low distraction, airway specialist |
| `delayed_rt` | Delayed RT | Slow setup, moderate competence |
| `eager_intern` | Eager Intern | Very high initiative but prone to errors |
| `distractible_intern` | Distractible Intern | High distractibility, needs explicit direction |
| `efficient_pharmacist` | Efficient Pharmacist | Very fast execution, proactive med timing |
| `interfering_senior` | Interfering Senior | `independent` compliance, challenges leader |

**BehaviorProfile fields** (all floats 0–1):
- `initiative` — likelihood of spontaneous action without being asked
- `distractibility` — chance of losing focus mid-task
- `clarificationTendency` — how often the NPC asks for clarification
- `executionSpeed` — how fast orders complete
- `assertiveness` — confidence level in communication

---

## 11. Room Views

Both views receive `{ ui: UIState, actions: EngineActions }` as props.

### IsometricRoom (`IsometricRoom.tsx`)

SVG-based top-down isometric view. Key constants:
```
ROOM_W = 1000   (SVG coordinate width)
VIEW_H = 430    (visible SVG height)
VIEW_MIN_Y = 60 (top crop of the SVG viewBox)
```

**Furniture zones** (SVG `cx, cy, w, h`):
| Zone | cx | cy | w | h |
|---|---|---|---|---|
| `airway_station` | 500 | 80 | 250 | 90 |
| `defib_station` | 760 | 210 | 190 | 95 |
| `patient_bed` | 500 | 320 | 260 | 130 |
| `medication_station` | 130 | 200 | 175 | 110 |
| `door` | 500 | 480 | 100 | 50 |

**Team avatar positions** (% of container, `ROLE_POSITIONS`):
| Role | x% | y% |
|---|---|---|
| airway | 50 | 5 |
| monitor_defib | 79 | 28 |
| medication | 22 | 27 |
| iv_access | 30 | 44 |
| compressor | 67 | 46 |
| leader | 64 | 60 |
| recorder | 16 | 10 |
| timekeeper | 18 | 74 |
| none | 88 | 83 |

Right-click menus (context menus) open at the actual mouse position within the container; anchor is computed from `containerRef.getBoundingClientRect()`.

**Zoom:** `roomZoom` state, stored in `localStorage` key `'acls-iso-zoom'`, range 0.6–2.2. Applied as `scale(roomZoom)` to the inner scene div. Scroll wheel supported.

**Callout tags:** The furniture label tags have staggered entrance (60 ms per zone), spring animation, pulse when their menu is open, and spring-back on close.

---

### FirstPersonRoom (`FirstPersonRoom.tsx`)

CSS 3D perspective scene. Key constants:
```ts
SW   = 900    // scene width  (px)
SH   = 480    // scene height (px)
SD   = 540    // scene depth  (px)
PERSP = 720   // CSS perspective (px)
OX = 450      // perspective origin x (SW/2)
OY = 173      // perspective origin y (SH * 0.36 — eye level)
FLOOR_Y = 430 // floor plane y coord (SH - 50)
```

**3D team member positions** (`ROLE_3D` — scene x, z):
| Role | x | z |
|---|---|---|
| leader | — | — (you; not rendered) |
| compressor | 450 | -238 |
| airway | 340 | -372 |
| iv_access | 120 | -300 |
| medication | 780 | -340 |
| monitor_defib | 810 | -210 |
| recorder | 140 | -130 |
| timekeeper | 680 | -80 |
| none | 840 | -52 |

**Scene layers (render order):**
1. CSS 3D perspective div (walls, floor, ceiling, furniture — all `pointerEvents: none`)
2. 2D projected overlay div — team figures (stick figures + badges), patient hotspots (AIRWAY/PADS/CPR/IV)
3. Flat HUD overlays — shock flash, defib-charged strip, door button, chaos meter, hint text
4. Zoom controls (bottom-left, `z-index: 30`)
5. Context menu (`z-index: 50`)

**Projection function** `project(x, z)` maps 3D scene coords → 2D pixel position using linear depth interpolation; returns `{ px, py, s }` where `s` is the perspective scale factor (1.0 at nearest, ~0.4 at far wall).

**CSS 3D hit zones:** Rotated `rotateX(-90deg)` planes do NOT reliably receive pointer events. All clickable overlays (patient hotspots, team member figures) use projected 2D divs, not 3D geometry.

**Zoom:** `roomZoom` state, stored in `localStorage` key `'acls-fp-zoom'`, range 0.6–2.2. Applied as `scale(roomZoom)` to a wrapper div that contains only the 3D + 2D scene layers (NOT the HUD overlays, shock flash, or context menu).

---

## 12. HUD Panels (GameScreen.tsx)

All panels are collapsible (`useState(true)` — open by default). Layout:

| Position | Panels |
|---|---|
| `top-left, z-20, w-200px` | VitalsMonitor, StopwatchWidget |
| `top-right, z-20, w-200px` | PendingOrdersPanel, ProtocolReminders |
| `bottom-right, z-20, w-280px` | EventLog, HsCausesPanel, TeamQuickActions |

**Protocol Reminders** and **Team Quick Actions** are defined inline in `GameScreen.tsx`. All other panels are in their own files.

---

## 13. Context Menu Pattern

Both room views use the same `ActiveMenu` pattern:
```ts
interface ActiveMenu {
  targetId: string;      // zone id or member id or 'door'
  title: string;
  items: MenuAction[];
  anchor: { x: number; y: number };  // % of container, clamped 5–70%
}
```

Menu items are built by functions like `patientMenu()`, `defibMenu()`, `memberMenu(m)`, etc. Every item calls `act(fn)` which calls the action then calls `close()`. All clinical logic goes through `actions.*` — never mutate state directly from the menu.

---

## 14. Replay / Event Log

The engine appends `ReplayEvent` objects to `state.replay.events` for every significant thing that happens. The scoring engine reads these events at debrief time.

Event types used in scoring:
- `pendingOrder.issued`, `pendingOrder.completed`, `pendingOrder.delayed`, `pendingOrder.missed`, `pendingOrder.failed`, `pendingOrder.wrong_recipient`
- `user.rhythm_check`, `user.start_cpr`, `user.closed_loop_request`, `user.declare_rosc`, `user.call_time_of_death`
- `team.role.confirmed`
- `scenario.chaos.fired`

---

## 15. What NOT to Modify

| File/area | Reason |
|---|---|
| `src/engine/index.ts` and all `engine/` files | Pure simulation logic — changes affect scoring, event log, and debrief fidelity |
| `src/engine/types/*.ts` | Type contracts shared across the whole engine |
| `src/engine/scoring/schemeE.ts` | Scoring rubric — changes affect educational validity |
| The `project()` function in `FirstPersonRoom.tsx` | Perspective math that all 3D objects and overlays depend on |
| `UIState` interface in `uiStateEngine.ts` | All components depend on this shape |

---

## 16. Safe Extension Points

| What to build | Where |
|---|---|
| New HUD panel | New file in `components/game/`, add to `GameScreen.tsx` |
| New context menu item | Add to the relevant `*Menu()` function in the room file |
| New room interactive object | Add as projected 2D overlay (not CSS 3D) using the `project()` pattern |
| New scenario | New file in `engine/scenario/`, call `buildWitnessedVfArrest`-style function |
| New NPC archetype | Add to `STAFF_ARCHETYPES` in `engine/team/archetypes.ts` |
| New chaos event type | Add to `ChaosEventType` union in `core.ts`, handle in `scenarioEngine.ts` |
| New team role | Add to `TeamRole` union and all `Record<TeamRole, ...>` maps |
| New scoring bucket | Add bucket function in `schemeE.ts`, add to `computeSchemeE()` |
| New medication | Add to `MedicationType` union in `core.ts` and `MEDICATION_LABELS` |

---

## 17. Credential & Role Visual System

Team member figures in both views display a dual-badge name plate:

**Credential badge** (always shown, color by `staffType`):
| staffType | Label | Color |
|---|---|---|
| nurse | RN | Teal |
| attending | Attending | Gold |
| resident | Resident | Lavender |
| rt | RT | Mint |
| tech | Tech | Slate |
| student | Student | Sky blue |
| pharmacist | PharmD | Emerald |

**Role badge** (shown when assigned):
- Uses `ROLE_BADGE_CLS` Tailwind classes by `TeamRole`
- Shows `✓ ROLE` when `confirmedRole === true`

**Unassigned state** (`assignedRole === 'none'`):
- Figure: `filter: saturate(0.12) brightness(0.5)` (greyed out)
- Outline: dashed red
- Badge: blinking `⚠ NONE` in red (Framer Motion `opacity` keyframes)

---

## 18. Seeded RNG

`src/engine/rng.ts` — FNV-1a hash seeded from the user's optional seed string (defaults to `code_${Date.now()}`). All random decisions in the engine (NPC behavior variance, chaos trigger timing) must consume from `state.rng` and return the new RNG state — never call `Math.random()` in engine code.

---

## 19. Dev Mode

`src/engine/devMode.ts` + `DevScorePanel.tsx` — a live score preview visible during play (for development). Toggled by a flag; not part of the educational UI.

---

## 20. Adding a New Scenario (checklist)

1. Create `src/engine/scenario/myScenario.ts` exporting a `buildMyScenario(seed: string): ScenarioInput` function
2. Add the scenario to `StartScreen.tsx` (scenario picker)
3. Call `startGame(seed)` → `buildMyScenario(seed)` is invoked by the hook
4. The existing scoring rubric applies automatically; adjust `schemeE.ts` only if clinical criteria differ
5. Add any new chaos types to `ChaosEventType` in `core.ts` and handle in `scenarioEngine.ts`
