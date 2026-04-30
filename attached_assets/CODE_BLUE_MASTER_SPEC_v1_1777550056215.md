# Code Blue Simulator — Master Spec v1

## 0. Status

Version: v1  
Canonical source: this Markdown file in a version-controlled repo  
Product stage: pre-MVP / first playable prototype  
Clinical status: educational simulation only; not medical advice; not patient care software

This file is the source of truth. Claude, ChatGPT, Codex, Replit, Cursor, or any other AI tool may critique or implement from this file, but no tool may silently redefine the product.

---

## 1. Product Thesis

Code Blue Simulator is a browser-based clinical leadership simulator for internal medicine training.

The goal is not to make another ACLS quiz.

The goal is to train high-pressure code leadership:

- rhythm recognition
- timed interventions
- CPR continuity
- delegation
- closed-loop communication
- team confusion
- interruptions
- delayed tasks
- post-event replay and debrief

The simulator should feel like a tense leadership drill, not a trivia app with ACLS labels.

---

## 2. Clinical Scope

### Provisional clinical reference

Use current AHA ACLS guidance as the clinical reference layer.

Clinical claims must be verified by the user against AHA ACLS source material or qualified clinical reviewers before any residency-facing or PD-facing demo.

### Clinical guardrail

The app must distinguish:

1. Clinically established ACLS guidance
2. Design abstraction made for pacing or teaching
3. Unverified placeholder logic

The simulator may teach decision-making patterns, but it must not present itself as patient-specific medical advice.

---

## 3. Locked MVP Scope

### MVP must include

- Browser-based app
- No real patient data
- Educational disclaimer
- Deterministic first scenario engine
- ACLS rhythm/timer logic
- CPR quality metrics
- Defibrillation / epinephrine / amiodarone timing logic
- Team role system
- Pending orders queue
- Closed-loop communication states
- Chaos / miscommunication events
- Scenario event log
- Scoring engine
- Replay timeline
- Debrief screen

### Initial rhythms

- VF / pulseless VT
- PEA
- Asystole
- ROSC

### Initial team roles

- Leader / user
- Compressor
- Nurse / meds
- Defib operator
- Airway / RT
- Recorder

---

## 4. Explicit Non-Scope

Do not build yet:

- Multiplayer
- Voice recognition
- AI free-text team members
- Mobile native app
- Custom 3D animation
- EHR integration
- Login/auth
- Payment
- Real patient data handling
- Open-ended medical chatbot inside the simulator
- Procedurally generated clinical recommendations

Rationale:

The first version must prove the training loop before adding expensive complexity.

---

## 5. Time Model

### Locked MVP decision

Use **1:1 real-time** for MVP.

The first playable scenario should be completable in **5–8 minutes real time** by choosing a short clinical scenario: witnessed VF/pulseless VT arrest with possible rapid ROSC.

### Why not compressed time by default?

Compressed time may weaken the exact skill being trained: sustained attention, leadership under pressure, order timing, and team management.

### Future options

Future versions may support:

- accelerated tutorial mode
- pause-and-teach mode
- long-form 20–30 minute code simulations
- accelerated replay only

But MVP starts 1:1.

---

## 6. Determinism Model

### Locked MVP decision

Use **state-machine determinism with seeded chaos**.

Meaning:

Same scenario seed + same user actions + same timing = same outcome.

This allows replay, testing, and fair scoring while still permitting chaos events.

### Do not use

- Pure scripted timeline only
- Fully random simulation
- LLM-generated scenario state during active gameplay

---

## 7. Core Architecture

The app must separate clinical logic from UI.

Required engines:

1. scenarioEngine
2. rhythmEngine
3. physiologyEngine
4. teamEngine
5. pendingOrdersEngine
6. scoringEngine
7. replayEngine
8. uiStateEngine

Engine names alone are not architecture. Each engine must define inputs, outputs, and dependencies.

---

## 8. Engine Interfaces v1

### 8.1 scenarioEngine

Purpose:  
Owns scenario setup, initial state, win/loss conditions, event schedule, and scenario seed.

Reads from:

- user selected scenario
- scenario config
- replay seed

Writes to:

- initial rhythm state
- team state
- physiology state
- scenario events

Input shape:

```ts
type ScenarioInput = {
  scenarioId: string;
  seed: string;
  difficulty: "intro" | "standard" | "advanced";
};
```

Output shape:

```ts
type ScenarioState = {
  scenarioId: string;
  elapsedSeconds: number;
  phase: "not_started" | "active_code" | "rosc" | "ended";
  seed: string;
  activeEvents: ScenarioEvent[];
};
```

---

### 8.2 rhythmEngine

Purpose:  
Tracks cardiac rhythm, shockability, rhythm checks, pulse checks, and rhythm transitions.

Reads from:

- scenarioEngine
- physiologyEngine
- user actions
- timed events

Writes to:

- current rhythm
- shockable status
- rhythm transition events

Input shape:

```ts
type RhythmInput = {
  currentRhythm: Rhythm;
  elapsedSeconds: number;
  lastShockTime?: number;
  lastEpinephrineTime?: number;
  cprActive: boolean;
};
```

Output shape:

```ts
type RhythmState = {
  rhythm: "VF" | "pulselessVT" | "PEA" | "asystole" | "ROSC";
  shockable: boolean;
  pulsePresent: boolean;
};
```

---

### 8.3 physiologyEngine

Purpose:  
Tracks simplified physiologic state for training feedback.

MVP physiology metrics:

- CPR quality
- compression fraction
- perfusion index
- oxygenation index
- ROSC probability proxy

Important:  
These are teaching abstractions, not patient-accurate physiologic models.

Reads from:

- CPR actions
- airway actions
- rhythmEngine
- pendingOrdersEngine

Writes to:

- physiologic indicators
- ROSC likelihood state
- deterioration/improvement events

Input shape:

```ts
type PhysiologyInput = {
  cprActive: boolean;
  compressionFraction: number;
  airwayManaged: boolean;
  rhythm: Rhythm;
  recentActions: ActionEvent[];
};
```

Output shape:

```ts
type PhysiologyState = {
  compressionFraction: number;
  perfusionIndex: number;
  oxygenationIndex: number;
  roscProbabilityProxy: number;
};
```

---

### 8.4 teamEngine

Purpose:  
Owns team roles, availability, fatigue, confusion, and communication reliability.

Reads from:

- user orders
- chaos events
- pendingOrdersEngine
- scenarioEngine

Writes to:

- role states
- acknowledgment events
- fatigue events
- miscommunication events

Input shape:

```ts
type TeamInput = {
  roles: TeamRoleState[];
  activeChaosEvents: ChaosEvent[];
  issuedOrders: PendingOrder[];
};
```

Output shape:

```ts
type TeamState = {
  roles: TeamRoleState[];
  communicationLoad: number;
  chaosLevel: number;
};
```

---

### 8.5 pendingOrdersEngine

Purpose:  
Tracks orders from issuance to completion/failure.

Closed-loop communication state machine:

```text
issued → heard → acknowledged → in_progress → completed
                         ↘ delayed / wrong_recipient / failed / missed
```

Reads from:

- user actions
- teamEngine
- scenarioEngine timer
- chaos events

Writes to:

- pending orders queue
- completed actions
- failed/missed order events

Input shape:

```ts
type PendingOrderInput = {
  orderType: OrderType;
  targetRole?: TeamRole;
  issuedAt: number;
};
```

Output shape:

```ts
type PendingOrder = {
  id: string;
  orderType: OrderType;
  targetRole?: TeamRole;
  status:
    | "issued"
    | "heard"
    | "acknowledged"
    | "in_progress"
    | "completed"
    | "delayed"
    | "wrong_recipient"
    | "failed"
    | "missed";
  issuedAt: number;
  completedAt?: number;
};
```

---

### 8.6 scoringEngine

Purpose:  
Scores the user’s performance during and after the scenario.

### Scoring model

Use **Scheme E — Two-tier leadership-emphasized scoring with a mechanics floor.**

Final score = 100 points.

Buckets:

- ACLS Timing: 15 points
- CPR Continuity: 20 points
- Defibrillation / Medication Appropriateness: 15 points
- Delegation and Closed-Loop Communication: 25 points
- Leadership Under Chaos: 25 points

Rationale:

The simulator is not intended to be another ACLS quiz. Leadership, delegation, communication, and recovery under pressure should be the differentiators. However, poor CPR continuity, poor rhythm response, or inappropriate defibrillation/medication decisions must still meaningfully limit the score.

### Per-bucket formulas

#### 1. ACLS Timing — 15 points

Score based on the percentage of timed interventions completed within the expected window.

Examples include:

- rhythm checks
- shock timing for shockable rhythms
- medication timing where applicable

Rules:

- Full credit: correct action within window
- Partial credit: correct action attempted late
- No credit: omitted or clinically inappropriate timing

Clinical timing windows must be verified against the selected AHA ACLS guideline edition before external demo.

#### 2. CPR Continuity — 20 points

Score based on compression fraction and excessive pause penalties.

Rules:

- Target compression fraction: ≥80%
- Each pause >10 seconds creates a proportional penalty
- Repeated or prolonged pauses compound the penalty

Debrief must show concrete arithmetic.

Example:

> CPR Continuity: 17/20 — compression fraction 82%, one 13-second pause at 03:42 cost 3 points.

#### 3. Defibrillation / Medication Appropriateness — 15 points

Score binary appropriateness decisions by rhythm and scenario state.

Rules:

- Correct defibrillation decision for shockable rhythm: credit
- Inappropriate shock for non-shockable rhythm: penalty
- Correct medication choice/timing: credit
- Incorrect or contraindicated action: penalty
- No extra bonus for merely doing expected actions correctly

#### 4. Delegation and Closed-Loop Communication — 25 points

Score the percentage of orders that complete the closed-loop state machine without communication failure.

State machine:

```text
issued → heard → acknowledged → in_progress → completed
```

Failure states:

```text
delayed / wrong_recipient / failed / missed
```

High score requires:

- assigning tasks clearly
- targeting the correct team role
- obtaining acknowledgment
- following through to task completion

Example:

> Delegation/CLC: 21/25 — 7 of 8 orders completed full closed-loop; one medication order was acknowledged but delayed.

#### 5. Leadership Under Chaos — 25 points

Score recovery from injected chaos events.

Formula components:

- time from chaos event onset to next correct stabilizing action
- whether the user notices the disruption
- whether the user redirects the team appropriately
- whether the chaos event cascades into a second failure

Examples:

- compressor fatigue noticed and corrected quickly: high credit
- medication delay recognized and reassigned: high credit
- wrong team member responds and user fails to correct: penalty
- chaos event causes missed shock/medication window: larger penalty

### Debrief requirement

The debrief must show arithmetic per bucket, not vague labels.

Bad:

> CPR Continuity: 90%

Better:

> CPR Continuity: 18/20 — compression fraction 84%, one 12-second pause at 03:42 cost 2 points.

Output shape:

```ts
type ScoreReport = {
  totalScore: number;
  buckets: {
    aclsTiming: number;
    cprContinuity: number;
    defibMedication: number;
    delegationCommunication: number;
    leadershipUnderChaos: number;
  };
  strengths: string[];
  misses: string[];
  teachingPoints: string[];
};
```

---

### 8.7 replayEngine

Purpose:  
Records everything important for review, debugging, teaching, and deterministic replay.

Reads from:

- all engines
- user actions
- system events

Writes to:

- event log
- replay timeline
- debrief screen

Output shape:

```ts
type ReplayEvent = {
  timestamp: number;
  source:
    | "user"
    | "scenario"
    | "rhythm"
    | "physiology"
    | "team"
    | "pendingOrder"
    | "score";
  eventType: string;
  payload: Record<string, unknown>;
};
```

---

### 8.8 uiStateEngine

Purpose:  
Maps simulation state into UI state.

Important:  
The UI may display state, but it should not own clinical or scoring logic.

Reads from:

- scenarioEngine
- rhythmEngine
- physiologyEngine
- teamEngine
- pendingOrdersEngine
- scoringEngine
- replayEngine

Writes to:

- visible panels
- alerts
- buttons enabled/disabled
- animations
- debrief display

---

## 9. Starter Chaos Taxonomy

Cap MVP chaos/miscommunication events at five types:

1. Delayed acknowledgment
2. Wrong team member responds
3. Compressor fatigue
4. Medication delay
5. Defib readiness delay

For scenario #1, use only two injected chaos events:

1. Compressor fatigue
2. Medication delay

Do not add more chaos types until the first scenario is playable.

---

## 10. First Playable Scenario

### Scenario name

Witnessed VF/pulseless VT arrest with possible rapid ROSC

### Real-time duration

5–8 minutes

### Time model

1:1 real time

### Injected chaos events

1. Compressor fatigue
2. Medication delay

### Core learning objectives

- Start CPR quickly
- Assign compressor
- Maintain CPR continuity
- Identify shockable rhythm
- Charge defibrillator
- Shock appropriately
- Give epinephrine at appropriate interval
- Consider amiodarone if persistent shockable rhythm
- Use closed-loop communication
- Manage compressor fatigue
- Recognize medication delay
- Redirect team when delay occurs
- Avoid long rhythm-check/pulse-check interruptions
- Reach ROSC or complete a debriefable attempt

### MVP success condition

The user can complete the scenario from start to debrief without developer intervention.

---

## 11. MVP Screen Map

### Start screen

- Title
- Educational disclaimer
- Scenario selection
- Start button

### Active code screen

- Central patient/code panel
- Rhythm monitor
- Code timer
- CPR status
- Team role bubbles
- Action/order buttons
- Pending orders queue
- Event log
- Chaos alerts

### Debrief screen

- Final score
- Timeline replay
- Bucket scores
- Missed opportunities
- Teaching points
- Replay scenario button

---

## 12. Initial Action Buttons

MVP action buttons:

- Start CPR
- Assign compressor
- Rotate compressor
- Charge defibrillator
- Shock
- Give epinephrine
- Give amiodarone
- Rhythm check
- Pulse check
- Manage airway
- Ask for closed-loop confirmation

---

## 13. Design Principles

1. Build the deterministic leadership/timing/scoring engine first.
2. UI second.
3. Animation later.
4. Do not let the app become a superficial ACLS quiz.
5. Do not let scope creep outrun the first playable loop.
6. Every event should be replayable.
7. Every score penalty should be explainable.
8. Every clinical rule should be source-verifiable.
9. Every design abstraction should be labeled as an abstraction.
10. The product should train leadership under pressure, not just memorization.

---

## 14. Highest-Risk Assumptions

1. A 5–8 minute scenario is long enough to demonstrate value.
2. 1:1 real-time simulation is more useful than compressed time.
3. Simplified physiology can feel meaningful without becoming misleading.
4. Closed-loop communication can be simulated without voice input.
5. Keyboard/mouse action buttons are enough for MVP immersion.
6. Residents will find replay/debrief valuable enough to repeat scenarios.
7. The app can be credible without advanced animation.
8. The scoring model can be rigorous without pretending to be clinically perfect.
9. Scheme E weights correctly balance mechanics and leadership.
10. VF/pulseless VT is the right first scenario despite being less diagnostically complex than PEA.

---

## 15. Locked Decisions vs Open Questions

### Locked for MVP

- Browser-based MVP
- Deterministic scenario engine
- State-machine determinism with seeded chaos
- Replayable event log
- Team role system
- Pending orders queue
- Closed-loop communication state machine
- Scoring Scheme E
- Scenario #1: witnessed VF/pulseless VT
- Scenario #1 chaos events: compressor fatigue + medication delay
- 1:1 real-time
- 5–8 minute scenario duration
- No multiplayer in MVP
- No voice input in MVP
- No AI chatbot inside active simulation
- No real patient data

### Needs explicit verification or approval

- Exact ACLS guideline edition
- Exact rhythm-check timing rule
- Exact epinephrine timing rule
- Exact defibrillation sequence
- Exact amiodarone use/timing rule
- Exact CPR pause thresholds
- Exact compression fraction target
- Exact ROSC logic
- Whether first demo should target interns, residents, or attendings
- Whether PD-facing demo needs printable scoring report

---

## 16. Replit Build Prompt

Build a browser-based MVP for Code Blue Simulator.

Use this Master Spec as the source of truth. Do not redesign the product. Do not add features outside MVP scope.

Before coding, summarize:

1. File structure
2. Engine architecture
3. State flow
4. What you will not build yet

Tech preference:

React + TypeScript. Use a simple Node/TypeScript backend only if needed. Keep it runnable in Replit.

Required deliverable:

A working clickable prototype of the first scenario: witnessed VF/pulseless VT arrest with possible rapid ROSC.

The app must include:

- educational disclaimer
- start screen
- active code screen
- timer
- rhythm monitor
- CPR status
- team role bubbles
- action/order buttons
- pending orders queue
- timestamped event log
- chaos events
- scoring screen
- replay timeline

Required architecture:

Separate simulation logic from UI. Implement at least stub modules for:

- scenarioEngine
- rhythmEngine
- physiologyEngine
- teamEngine
- pendingOrdersEngine
- scoringEngine
- replayEngine
- uiStateEngine

Do not build:

- multiplayer
- voice input
- login/auth
- database
- payment
- mobile app
- free-text AI chatbot
- advanced animation

After coding, summarize:

1. What works
2. What is incomplete
3. How to run it
4. Where each engine lives
5. Known risks

---

## 17. Replit Audit Prompt

Audit the existing prototype against this Master Spec.

Do not write code yet.

Return:

1. Feature match table
2. Architecture assessment
3. Missing MVP requirements
4. Drift risks
5. Recommendation: keep/refactor, partial salvage, or rebuild

Use this decision rule:

- Keep/refactor if ≥70% matches spec and architecture is understandable.
- Partially salvage if UI is useful but logic is tangled.
- Rebuild if it is mostly quiz UI, animation shell, or spaghetti logic.

---

## 18. Refactor Prompt if Audit Passes

Refactor the existing Code Blue Simulator prototype to conform to this Master Spec.

Before coding, summarize:

1. Files you will modify
2. Engine modules you will create
3. What current functionality you will preserve
4. What you will remove or defer

Do not add:

- multiplayer
- voice input
- login/auth
- database
- payment
- mobile app
- free-text AI chatbot
- advanced animation

Priority:

1. Make scenario #1 playable.
2. Separate simulation logic from UI.
3. Implement event log and replay.
4. Implement scoring scheme E.
5. Add compressor fatigue and medication delay chaos events.
6. Preserve useful UI components if they do not conflict with the spec.

---

## 19. Red-Team Prompt for Claude or Other Reviewer

Red-team this spec.

Do not rewrite it.

Identify:

1. Weak assumptions
2. Missing interfaces
3. Clinical-verification risks
4. Scope creep
5. Scoring model weaknesses
6. Scenario design weaknesses
7. Risks that would make the existing prototype worth rebuilding instead of refactoring

Mark every proposed change as one of:

- Necessary
- Optional
- Reject / do not pursue yet

Do not introduce new scope unless you label it as a proposed change.