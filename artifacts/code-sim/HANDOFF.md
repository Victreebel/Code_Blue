# ACLS Code Simulation — UI/UX Handoff

> **Context**: This document is a handoff for a future agent focused on UI/UX cleanup. The engine is stable and deterministic. The UI works functionally but needs polish, proportion fixes, and layout refinement.

---

## 1. What Was Built (Last Session)

### Functional
- ACLS Code Blue Simulator — browser-based medical training app
- Real-time 5–8 minute simulation with 6-person team, scoring, and debrief
- 13/13 engine tests passing (determinism, scoring, golden-trace, replay API)
- Deterministic engine: `tickOnce(state)` → new state, seeded RNG, no `Math.random` in engine

### UI Components
- `StartScreen.tsx` — landing page with scenario card, seed input, history panel
- `BriefingScreen.tsx` — pre-code briefing with patient info and team layout
- `GameScreen.tsx` — active-play HUD shell (4 corners of panels)
- `IsometricRoom.tsx` — top-down SVG isometric room view (favourite view)
- `FirstPersonRoom.tsx` — CSS 3D first-person room view (alternative view)
- `VitalsMonitor.tsx` — vitals HUD panel (HR, BP, SpO2, EtCO2, rhythm)
- `PendingOrdersPanel.tsx` — order queue HUD panel
- `StopwatchWidget.tsx` — clock/stopwatch HUD panel
- `EventLog.tsx` — replay event log HUD panel
- `DebriefScreen.tsx` — post-code score report with per-bucket breakdown
- `CommandPanel.tsx` — action buttons (§12 MVP: CPR, defib, epi, amio, rhythm, pulse, airway, CLC)
- `TeamPanel.tsx` — team role assignment and confirmation
- `DevScorePanel.tsx` — live score preview during play (dev mode only)

### Recent Changes (This Session)
1. HUD panels default to **closed** (`useState(false)` for all collapsible panels)
2. **Zoom removed** from both IsometricRoom and FirstPersonRoom
3. **Compressor avatar** now moves dynamically from idle position to bed position only when `ui.cprActive`
4. **Leader position** moved to `x:73, y:62` (outside bed rectangle)
5. **Proportional sizing** partially implemented in IsometricRoom:
   - Avatar circles now use `ResizeObserver` to scale with container width (`0.026 * width`, clamped 16–26px)
   - Fatigue halo also scales with container
   - Furniture heights increased (crash cart `bFh: 110`, defib monitor `monFh: 90`, etc.)
   - **User still reports this "looks weird" — needs further refinement**

---

## 2. Tech Stack (Must Respect)

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Package manager | pnpm (monorepo workspace) |
| 3D rendering | **Pure CSS 3D — no Three.js, no WebGL** |
| Auth | Clerk (dev keys; not required for game play) |
| State | `useReducer` + `useRef` — **no Redux, no Zustand** |

**Critical rule**: The engine (`src/engine/`) is pure and functional. Never modify engine files. UI components are dumb selectors over `UIState` (derived by `selectUIState()`). All state changes go through `EngineActions`.

---

## 3. Known UI/UX Issues (Prioritized)

### 🔴 HIGH — Proportional Sizing in IsometricRoom
**Status**: In-progress. User reports "looks weird" after the first attempt.

**Problem**: The avatar circles (HTML overlay divs) and furniture (SVG polygons) scale differently. Avatars scale with container width via `ResizeObserver`, while furniture scales with SVG `viewBox`. The proportions feel off at different window sizes.

**Current approach** (in `IsometricRoom.tsx` ~line 1003):
```ts
const [containerSize, setContainerSize] = useState({ width: 700, height: 500 });
useEffect(() => {
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const cr = entry.contentRect;
      setContainerSize({ width: cr.width, height: cr.height });
    }
  });
  ro.observe(containerRef.current);
  return () => ro.disconnect();
}, []);
const avatarSize = Math.max(16, Math.min(26, containerSize.width * 0.026));
const avatarStyle = { width: avatarSize, height: avatarSize, fontSize: Math.max(6, avatarSize * 0.3) };
const haloSize = Math.max(18, Math.min(30, containerSize.width * 0.032));
```

**Furniture heights** (SVG `fh` values — controls vertical height of side faces):
- Zone boxes: `airway fh: 26`, `medication fh: 26`, `defib fh: 26`, `patient_bed fh: 22`, `door fh: 10`
- `MedCartFurniture` crash cart: `bFh: 110`
- `DefibFurniture` base: `baseFh: 20`, monitor: `monFh: 90`
- `AirwayCartFurniture` body: `bFh: 40`
- `PatientBedFurniture` rail: `railFh: 16`

**What to fix**:
- The avatar is probably too small now (16–26px at ~700px container = 18px). The avatar text is unreadable at ~5px.
- The furniture is probably too tall and clipping or looking like skyscrapers.
- The zone `fh` (outer box) values may not match the internal furniture heights, causing visual misalignment.
- **Recommendation**: Use a `vw` or `vmin` unit approach instead of `ResizeObserver` for a simpler scaling model. Or keep `ResizeObserver` but tune the ratios.
- Consider: a real hospital crash cart is ~1m wide × ~1m tall (standing height). A person is ~1.7m tall. In the isometric view, the cart should be **shorter than a person** but still **substantially tall** — the previous crash cart `bFh: 50` was too small, but `bFh: 110` may be too tall.
- The bed zone fh is `22` while the bed rail fh is `16` — the bed itself looks squat compared to its zone box. The zone `fh` values create the outer 3D box of the zone; the furniture is inside it. If `fh` is too large, the zone looks like a tall wall around the furniture.
- **Test**: The user needs to see the game in action to judge. Currently the app requires clicking "RUN CODE" to reach the GameScreen. The start screen is the only thing visible in the preview.

**Suggestion approach**:
1. Reduce `avatarSize` multiplier to `0.035` (so at 700px = 24.5px) and min clamp to 20px
2. Reduce furniture `bFh` values proportionally — a crash cart should be about `bFh: 60–70` (visually imposing but not skyscraper)
3. Reduce zone `fh` values back to `10–14` for all stations (they're too tall as walls)
4. The `FirstPersonRoom` has similar issues — avatar `AVATAR_R = 22` is fixed, but furniture scales via `project()` `s` factor. Consider the same responsive approach there.

---

### 🔴 HIGH — HUD Panel Visibility (Default Closed)

**Current state**: All collapsible panels are default closed (`useState(false)`):
- H's & T's panel (`HsCausesPanel`)
- Team/Other panel (`TeamQuickActions`)
- Reminders (`ProtocolReminders` — inline, always visible but collapsible via `open` state)
- Event Log (`EventLog`)

**Problem**: A new user landing on the game screen sees a mostly empty room with vitals in the top-left and a clock in the bottom-left. No guidance on what to do next. The panel labels are tiny (`text-[10px]`). A first-time user won't know to click them.

**What to fix**:
- Consider **auto-opening the most relevant panels** during play:
  - On `cprActive` → auto-open Team/Other panel (show "Rotate Compressor" button)
  - On first `pendingOrder` → auto-open Event Log panel
  - On `chaosFiredCount` > 0 → auto-open Event Log or flash a toast
- Or: Keep them closed by default but add a **first-time overlay** or **tutorial hints** that points to each panel
- Or: Make the panel header buttons more prominent — maybe a badge count showing how many items are inside

---

### 🔴 HIGH — First-Time User Experience (FTUE)

**Problem**: The game dumps the user into a dark room with a vitals monitor and a bunch of collapsed panels. There's no "what do I do first" guidance. The player is the Code Leader, but the UI doesn't communicate the opening sequence:
1. Start CPR
2. Charge defib
3. Assign roles
4. Check rhythm

**What to fix**:
- Add a **floating hint system** or **step-by-step tutorial** for the first 30 seconds
- Highlight the first action (e.g., "Start CPR" button pulses/glows) until the user clicks it
- Add a **checklist** or **progress indicator** on the screen (e.g., "□ Start CPR  □ Charge Defib")
- Consider a brief **overlay on first play** explaining the HUD

---

### 🟡 MEDIUM — Start Screen Polish

**Current state**: `StartScreen.tsx` is functional but utilitarian. It has:
- Title "ACLS Code Simulator"
- Educational Use Only disclaimer
- Scenario card ("Witnessed VF Arrest — Bed 4")
- Seed input
- Run Code button
- History panel (my past runs)

**What to fix**:
- The educational disclaimer is too prominent and intimidating. It's a full-width card at the top.
- The scenario card is small and buried. The seed input is confusing for most users.
- The "Run Code" button is good (red, prominent), but the whole layout feels like a form, not a game.
- **Suggestion**: Make the scenario card larger, with a patient icon or illustration. Move the disclaimer to a smaller footer or a modal that shows on first visit. Add a visual "new game" vs "resume" feel.

---

### 🟡 MEDIUM — Briefing Screen

**Current state**: `BriefingScreen.tsx` shows patient info and team layout. The user clicks "BEGIN CODE" to start.

**What to fix**:
- The briefing is text-heavy. Consider adding a team member preview (who they are, their archetypes)
- Add a "Suggested Opening Sequence" or checklist here
- The button is plain — make it feel more like "ENTER THE ROOM"

---

### 🟡 MEDIUM — Debrief Screen

**Current state**: `DebriefScreen.tsx` shows the score report with 5 buckets, a breakdown of each, strengths, misses, and teaching points.

**What to fix**:
- The score is shown as text/numbers. Consider adding a visual gauge or bar chart for each bucket
- The teaching points are good but could be formatted better (bullet points, icons)
- Missing: A "Download Report" or "Share" button
- Missing: A "Play Again" button that's more prominent

---

### 🟡 MEDIUM — Callout Tags in Isometric Room

**Current state**: The zone labels ("AIRWAY", "MEDS", "DEFIB", etc.) are SVG text inside the isometric room. They pulse when the menu is open. They appear for the first 8 seconds after the game starts.

**What to fix**:
- The 8-second auto-hide is too quick. New users won't have time to read all 5 labels.
- The labels are inside the SVG, so they scale with the room. At small sizes, they're unreadable.
- Consider: Always show the labels, but make them smaller and less prominent. Or show them as a legend in the corner.
- The staggered entrance animation (60ms per zone) is nice but if the labels are too short-lived, the animation is wasted.

---

### 🟡 MEDIUM — FirstPersonRoom (3D View)

**Current state**: `FirstPersonRoom.tsx` is a CSS 3D perspective scene. The room walls, ceiling, floor, and furniture are CSS 3D transforms. The team members are projected 2D overlays (stick figures + badges). The patient is at the center of the room.

**What to fix**:
- The 3D view has **proportional issues** similar to the isometric view. The team members are small circles at the back of the room. The furniture is just colored walls.
- The **patient is barely visible** — just a flat bed with a head. Needs a more recognizable patient silhouette.
- The **shock flash** (white screen flash) is good but too sudden. Consider a fade.
- The **chaos meter** is a small text bar at the bottom. It should be more prominent.
- The **door button** is tiny. The only way to get someone into the room is clicking it, but it's not obvious.

---

### 🟡 MEDIUM — Command Panel UX

**Current state**: `CommandPanel.tsx` is a grid of action buttons. The buttons change color based on state (e.g., "SHOCK" is red when charged).

**What to fix**:
- The button grid is cramped on small screens. Consider a responsive layout (e.g., 2-column on mobile, 3-column on desktop)
- The button labels are long (e.g., "Give Epinephrine 1mg"). Consider shorter labels with tooltips
- The disabled state is not very clear (grayed out but still looks clickable)
- The "SHOCK" button should be **much more prominent** when charged — it's the most critical action
- The active button (e.g., "Start CPR" when CPR is running) should have a visual "running" indicator (e.g., a pulsing border, a checkmark)

---

### 🟢 LOW — Text & Typography

**What to fix**:
- The monospace font is used everywhere. It works for vitals but is too utilitarian for UI text.
- Consider: Keep monospace for vitals/clinical data, but use a sans-serif for UI chrome (panels, buttons, labels)
- Font sizes are inconsistent: `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-xs` — create a consistent scale
- The `text-[8px]` and `text-[9px]` sizes are too small for most users. Minimum should be 10–11px.

---

### 🟢 LOW — Color Palette

**What to fix**:
- The dark theme is fine but very monochrome. The only colors are the zone accent colors (red, green, blue, amber, purple)
- The unassigned team member ("⚠ NONE") is red, which is the same color as critical actions
- Consider adding a subtle color to the room background (not just `#060a14`)

---

### 🟢 LOW — Animations

**What to fix**:
- Animations are good but could be more purposeful:
  - The avatar glide (1.4s) is slow — feels like the team is moving through molasses
  - The CPR bounce (0.55s) is good but the scale change is subtle
  - The defib charge pulse could be more dramatic
  - The callout tag entrance is nice but the exit is abrupt (no exit animation)

---

## 4. Actionable Priority List

### Immediate (Session 1)
1. **Fix proportional sizing** — Tune avatar size and furniture heights until the user is satisfied. Test at multiple window widths. (See section 3 above for current values and suggestions)
2. **HUD panel auto-open** — Revert some panels to default open or add auto-open triggers based on game state
3. **FTUE hint system** — Add a simple "Next Action: Start CPR" hint that appears on screen and fades after the user takes the first action

### Short-term (Session 2)
4. **Start screen polish** — Redesign layout to feel more like a game and less like a form
5. **Debrief screen visual polish** — Add score bars/gauges, improve typography, add a prominent "Play Again" button
6. **FirstPersonRoom furniture** — Make the furniture recognizable (add color, shape, icons)
7. **Command panel responsive layout** — Make it work on smaller screens

### Long-term (Session 3+)
8. **Animation polish** — Tune all durations, add exit animations, add more purposeful motion
9. **Color palette refinement** — Add subtle warmth, improve contrast
10. **Accessibility audit** — WCAG contrast, keyboard navigation, screen reader labels
11. **Mobile layout** — The HUD panels overlap on narrow screens. Consider a mobile-optimized layout

---

## 5. How to Test Changes

### Play the Game
1. Go to the app preview
2. Click "RUN CODE" on the StartScreen
3. The game starts in the `BriefingScreen` — click "BEGIN CODE" to enter the active GameScreen
4. Interact with the room (click zones, assign roles, start CPR, etc.)

### Run the Tests
```bash
pnpm --filter @workspace/code-sim run test
```
All 13 tests should pass. Do not modify `src/engine/` files.

### Check TypeScript
```bash
pnpm --filter @workspace/code-sim run typecheck
```

### Check the Engine Still Works
```bash
pnpm --filter @workspace/api-server run test
```

---

## 6. File Quick Reference

| Component | File | Notes |
|---|---|---|
| Start Screen | `src/components/game/StartScreen.tsx` | Landing page |
| Briefing Screen | `src/components/game/BriefingScreen.tsx` | Pre-code briefing |
| Game Screen | `src/components/game/GameScreen.tsx` | HUD shell layout |
| Isometric Room | `src/components/game/IsometricRoom.tsx` | **Main focus for sizing** |
| First Person Room | `src/components/game/FirstPersonRoom.tsx` | 3D CSS view |
| Vitals Monitor | `src/components/game/VitalsMonitor.tsx` | Vitals HUD |
| Command Panel | `src/components/game/CommandPanel.tsx` | Action buttons |
| Team Panel | `src/components/game/TeamPanel.tsx` | Role assignment |
| Debrief Screen | `src/components/game/DebriefScreen.tsx` | Score report |
| Event Log | `src/components/game/EventLog.tsx` | Replay log |
| Pending Orders | `src/components/game/PendingOrdersPanel.tsx` | Order queue |
| Stopwatch | `src/components/game/StopwatchWidget.tsx` | Clock |
| Engine Hook | `src/engine/useGameEngine.ts` | React hook — safe to read, not modify |
| UI State | `src/engine/ui/uiStateEngine.ts` | Derives UIState — safe to read, not modify |

---

## 7. Critical Constraints

- **Never modify `src/engine/` files** — all engine logic is pure and deterministic
- **All state changes go through `EngineActions`** — never call `dispatchUserAction` directly from a component
- **UIState is the only data contract** — components read from `UIState`, never from `SimulationState`
- **Do not add Redux or Zustand** — state is managed via `useReducer` + `useRef` in the engine hook
- **Tailwind v4 only** — no arbitrary CSS files for component styling
- **Framer Motion for animations** — no raw CSS transitions
- **Keep the game playable** — every change must leave the core flow intact

---

*Last updated: 2026-06-13*
