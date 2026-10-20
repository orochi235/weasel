# weaselchart grid, snapping and preferences — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give weaselchart a page grid, grid/alignment/spacing snapping and a persisted prefs schema, with diagram's route handles snapping through core's snap session.

**Architecture:** Core's `SnapBegin` gains per-gesture `sources` and `omit`; guides' alignment and spacing sources gain a node `filter`; diagram's route-edit action drops its private `routeSnap` for a session plus a per-drag source; draw's grid hook moves to `@editor`; chart adds `prefs.ts`, a View menu, and the canvas wiring.

**Tech Stack:** TypeScript, React, vitest (projects `core`, `weasel-ui`, `browser`), `@weasel-js/prefs`, `@weasel-js/guides`.

**Spec:** `docs/superpowers/specs/2026-10-19-chart-grid-snap-design.md`

## Global Constraints

- Every changeset is `patch`. Never write a `bump-approved` marker.
- No file over 400 lines or function over 120 (`npm run check:size`).
- All test/typecheck/lint runs go to the fleet via `onto` with `--kind` (memory: long runs go to onto); `npm run test:fleet` for whole-branch runs, `npm run test:gate` before merge.
- Core tests: `npx vitest run --project=core <path>`; find the project for any other dir with `npm run check:test-projects`.
- Publish package source uses relative imports (no path aliases).
- Grid default pitch 12, min 4, max 96, step 4; accent every 8th line; draws on the page only.
- Prefs defaults: `gridVisible` false, `snapToGrid` false, `alignmentSnap` true, `spacingSnap` true, `pipeline.look` `'nodeGraph'`.

## Review Focus

- Snap to grid on, alignment off: a moved body lands with its origin on the grid (no stray alignment from connectors' boxes). Pinned in Task 6's browser test.
- A route vertex dragged near a neighbor's y but far from any x target: y aligns, x takes the grid. Pinned in Task 3.
- Ctrl held during a route drag: no snap at all, segment still on its axis. Pinned in Task 3.
- Pipeline mode with no snap sources registered still edits routes (the action must work with the canvas's default sources and with no `snap` dep). Pinned in Task 3.
- Prefs store with a corrupt stored value (e.g. `gridSpacing: "x"`) falls back to the default. Pinned in Task 5.

---

### Task 1: Core — per-gesture snap sources and omit

**Files:**
- Modify: `packages/core/src/interactions/actions/snapDep.ts` (`SnapBegin`)
- Modify: `packages/core/src/canvas/deps/snap.ts` (`begin`)
- Modify: `packages/kernel3d/src/deps.ts` (its `begin`)
- Test: `packages/core/src/canvas/deps/snap.test.tsx`, kernel3d's deps test beside `deps.ts`
- Modify: `docs/snapping.md` (pieces table / "Writing an action that snaps": the two fields; "Gestures that snap": add route handles)
- Create: `.changeset/<name>.md` (patch, `@weasel-js/core`)

**Interfaces:**
- Produces: `SnapBegin.sources?: readonly SnapSource[]` — asked for this gesture only, after the canvas's sources and defaults, ranked under the same rule; `SnapBegin.omit?: readonly string[]` — source ids (canvas-listed, preset, registered or default) this gesture does not ask. A gesture source whose id collides with one still asked throws (`assertSnapSourceIds` over the final list).
- kernel3d: honors `omit` by id and appends `sources`. Its sources are `SnapSource<Vec3>` while `SnapBegin` is 2D-typed; make the field's type admit the host's world point type without `any` (e.g. `SnapBegin` generic over the source point type with `Point` default, or a `SnapSource<unknown>`-safe variance) — implementer's call, stated in the field's doc comment.

- [ ] **Step 1: Write failing tests** in `snap.test.tsx`: `'a gesture source is asked alongside the canvas sources'` (canvas has a fallback grid-like source at x=100 lines; gesture source offers a target line at x=103; pointer at 102 → `point.x === 103`); `'omit drops a canvas source for that gesture only'` (begin with `omit: ['path-snap']` near another node's anchor → not held; a second session without omit → held); `'a gesture source sharing an asked id throws'`. One kernel3d test: `omit` drops a listed source.
- [ ] **Step 2: Run** `onto do --kind test -- npx vitest run --project=core packages/core/src/canvas/deps/snap.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** In `begin`: `withDefaults(listed, s.omit)`, then filter out `req.omit`, then append `req.sources`, then `assertSnapSourceIds` on the result.
- [ ] **Step 4: Run** the two test files → PASS. Typecheck core and kernel3d (`npm run typecheck:packages -- core kernel3d`, via onto `--kind typecheck`).
- [ ] **Step 5: Commit** `add per-gesture snap sources and omit to SnapBegin`.

### Task 2: Guides — a node filter on alignment and spacing

**Files:**
- Modify: `packages/guides/src/sources/targets.ts` (`targetIds`, `targetBoxes`, `cachedPerScene`)
- Modify: `packages/guides/src/sources/alignment.ts`, `spacing.ts`, `packages/guides/src/spacingHints/preset.ts`
- Test: `packages/guides/src/sources/alignment.test.ts`, `spacing.test.ts`, `spacingHints/preset.test.ts`
- Create: `.changeset/<name>.md` (patch, `@weasel-js/guides`)

**Interfaces:**
- Produces: `filter?: (node: Node<unknown, string, unknown>) => boolean` on `AlignmentSnapSourceOptions`, `SpacingSnapSourceOptions` and `SpacingHintsOptions` (passed to both sources). Nodes it rejects offer no lines or gaps; it narrows the default sibling/top-level set and does not apply to `getCandidates`/`getTargets`.

- [ ] **Step 1: Failing tests:** `'filter keeps a rejected sibling from offering lines'` (two siblings, filter rejects the one in reach → no candidate); same for spacing; preset passes `filter` to both.
- [ ] **Step 2: Run** (project per `check:test-projects`) → FAIL.
- [ ] **Step 3: Implement**: `cachedPerScene(derive, filter?)` applies `filter` in `targetIds`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `filter which nodes alignment and spacing snap to`.

### Task 3: Diagram — route handles on core's snap session

**Files:**
- Modify: `packages/diagram/src/waypointAction.ts` (stays under 400 lines; put the source in a new file)
- Create: `packages/diagram/src/routeSnapSource.ts`
- Delete: `packages/diagram/src/routeSnap.ts` and its test; remove its exports from `packages/diagram/src/index.ts`
- Modify: `packages/diagram/src/contribution.ts` if the binding needs `modifierRoles`
- Test: `packages/diagram/src/waypointAction.test.ts` (existing; adapt), `routeSnapSource.test.ts`
- Create: `.changeset/<name>.md` (patch, `@weasel-js/diagram`; prose says `snapPoint`, `portTarget`, `stopTarget` and their types are removed, and route drags now snap through the canvas: grid, Ctrl to suspend, Shift to lock a bend's direction)

**Interfaces:**
- Consumes: Task 1's `SnapBegin.sources`/`omit`; core's `SNAP_ROLES`, `snapMods`.
- Produces: `routeSnapSource(opts: { id: string; stops: readonly Vec2[]; ports: readonly Port[]; reachPx: number }): SnapSource` — `tier: 'target'`, `roles: ['pointer']`, `gestures: ['point']`; per stop a line locus on each axis through it; per port a line along its axis (both axes for a port with no normal); each candidate's mark is a `line` from the target point to the snapped probe (a function of `δ`).
- `createRouteEditAction` keeps its options (`snapPx` → the source's `reachPx`, default 6).

- [ ] **Step 1: Failing tests** (rewrite the snap cases in `waypointAction.test.ts` to drive the action with a real snap dep, as core's own action tests do): `'a vertex aligns to a neighbor on y and takes the grid on x'` (grid source pitch 10 on the canvas; neighbor stop y=50; drag to (33, 52) → waypoint (30, 50)); `'a segment drag stays on its axis under Shift and Ctrl'`; `'Ctrl suspends every snap'`; `'Shift locks a vertex to 45° steps'`; `'route marks reach the readout store'`; `'with no snap dep the drag is unsnapped and a segment keeps its axis'`; `'the edited edge and shape anchors offer nothing'` (path-snap omitted, `ids: [edgeId]`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** At press: `ctx.deps.snap?.begin({ gesture: 'point', press, ids: [edgeId], omit: ['path-snap'], sources: [routeSnapSource(...)], constrain: 'axis' for a vertex/insert, handle: one-free-axis anchor for a segment })`; each move `session.at(world, snapMods(ctx)).point`; `end()` on release/cancel. Drop `overlay()`. Without a dep, a segment zeroes the off-axis delta itself. Add `snap` to `requires` and `SNAP_ROLES` to the action's `modifierRoles` (follow how core's move action declares both). Per-drag source id: `'diagram-route'`.
- [ ] **Step 4: Run** diagram tests and the effect editor tests (pipeline drives the same action) → PASS.
- [ ] **Step 5: Commit** `snap route handles through core's snap session`.

### Task 4: Shared grid hook

**Files:**
- Create: `apps/shared/editor/src/usePageGrid.ts`; export from `apps/shared/editor/src/index.ts`
- Modify: `apps/draw/src/useGrid.ts` (calls it)
- Test: `apps/shared/editor/src/usePageGrid.test.ts`

**Interfaces:**
- Produces: `usePageGrid(opts: { page: { width: number; height: number }; spacing: number; background: string; accentEvery: number; visible: boolean; snap: boolean }): { layer: RenderLayer<unknown> | undefined; source: SnapSource | undefined }` — both identity-stable while inputs hold; colors via `contrastLineColor(background, 0.06 / 0.14)` as draw does now.

- [ ] **Step 1: Failing test:** `'returns no layer or source when off, stable ones when on'` (rerender with same inputs → same objects).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**, move draw's body into it; draw keeps its prefs reads and `commands`, passes `accentEvery: 5`.
- [ ] **Step 4: Run** the new test and draw's grid-related tests → PASS.
- [ ] **Step 5: Commit** `move the page grid hook to the shared editor package`.

### Task 5: Chart prefs and the Preferences dialog

**Files:**
- Create: `apps/chart/src/prefs.ts`, `apps/chart/src/PreferencesDialog.tsx`
- Modify: `apps/chart/src/App.tsx` (look from prefs; mounts the dialog), `apps/chart/src/menuBar.ts` / `chartCommands.ts` / `pipeline/pipelineCommands.ts` (Preferences… in both View menus)
- Test: `apps/chart/src/prefs.test.ts`, `apps/chart/src/App.test.tsx`

**Interfaces:**
- Produces: `CHART_PREFS` (schema as in the spec's table, `satisfies PrefGroup`), `CHART_PREFS_PREFIX = 'weaselchart.prefs/'`, `openChartPrefs(storage: SyncStorageAdapter): PrefsStore<typeof CHART_PREFS>`, `chartPrefs()` (lazy over `localStorageAdapter`), `useChartPref<P extends ChartPrefPath>(path: P)` (over `usePref` from `@weasel-js/prefs/react`). Action id `CHART_ACTIONS.preferences = 'chart.preferences'`, label `Preferences…`.
- `PreferencesDialog({ open, onClose })`: ui's `PrefsDialog` over `usePrefsValues(chartPrefs())`, as draw's modal without its custom kinds.

- [ ] **Step 1: Failing tests:** prefs round-trip through a memory adapter; `'a corrupt stored spacing falls back to 12'`; App: View › Preferences… opens the dialog in chart and pipeline mode; the pipeline Look persists across a remount.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `add weaselchart preferences and a Preferences dialog`.

### Task 6: Chart grid, snapping and View menu

**Files:**
- Create: `apps/chart/src/useChartSnap.ts` (prefs → `{ gridLayer, snap, features }`)
- Modify: `apps/chart/src/ChartWorkspace.tsx`, `apps/chart/src/chartCommands.ts` (View menu: Show grid, Snap to grid toggles with `active`), `apps/chart/src/stencilDrop.ts`
- Possibly modify core: if a content handler's ctx has no route to the `snap` dep, add `snap?: SnapDep` to it and pass the canvas's dep (changeset for core)
- Test: `apps/chart/src/useChartSnap.test.ts`, `apps/chart/src/chart.browser.test.tsx`

**Interfaces:**
- Consumes: `usePageGrid` (Task 4), `useChartPref` (Task 5), `createSpacingHintsPreset({ spacing, align, filter, readout })` (Task 2).
- Body filter: `(node) => diagramEdgeOf(node) === null && diagramLabelOf(node) === null`.
- Produces: `useChartSnap(): { gridLayer: RenderLayer<unknown> | undefined; snap: SceneCanvasSnap; features: readonly FeatureEntry[] }` — `features` is `['draw']` plus the preset when either alignment or spacing is on (`readout: false` unless spacing is on); everything identity-stable per pref values. Action ids `chart.view.grid`, `chart.view.snapToGrid`, labels `Show grid`, `Snap to grid`.
- Grid layer: `layers={{ paper: …, grid: { layer, after: 'paper' } }}` (beneath the scene).
- Stencil drop: with a snap dep, begin a `'point'` session at the new body's would-be origin (drop point minus half its default size), take `at()`, end, and insert so the origin lands on the result.

- [ ] **Step 1: Failing tests:** `useChartSnap` stability and on/off; browser: with snap to grid on and alignment/spacing off, dragging a body by (17, 9) lands its origin on a multiple of 12; a dropped stencil's origin lands on the grid; a screenshot of the grid on the page goes on the wall (`transom post`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS (browser project via onto).
- [ ] **Step 5: Commit** `add a grid, snap to grid and shape snapping to weaselchart`.

### Task 7: Wrap-up

- [ ] Move anything durable from the spec into `docs/snapping.md` (done in Task 1) and `packages/diagram/README.md` (route snapping); delete the spec and this plan.
- [ ] `docs/TODO.md`: nothing to retire unless an entry names chart snapping; file any follow-up found.
- [ ] `npm run test:gate` and `npm run test:fleet -- HEAD` on the branch; merge to `main`; `npm run test:fleet` on `main` in the background.
