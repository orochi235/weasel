# One Snap Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace weasel's ten snap paths with one resolver that every gesture calls, in 2D and in
kernel3d, plus one readout layer.

**Architecture:**
- **Resolver:** a dimension-generic resolver over number tuples in `@weasel-js/geom/nd`.
- **Core:** owns the `SnapSource` contract, the session-shaped `snap` dep, the 2D session (probes,
  input subspace `H`), the outcome store and the readout layer.
- **Sources:** live with the package that owns their geometry.
- **Migration:** each action moves to `snap.begin()`, and the old APIs are deleted in the last
  task.

**Tech Stack:** TypeScript, React, vitest, the weasel dispatcher and deps.

**Spec:** `docs/superpowers/specs/2026-10-17-snap-pipeline-design.md`. Read it first; this plan
does not repeat its reasoning.

## Global Constraints

- Tests, typecheck and lint never run on this Mac.
  - Targeted runs: `onto do -in weasel-snap-arc -- npx vitest run --project=<project> <files>`.
  - Whole-commit runs: commit, then `npm run test:fleet`; its `gate` project covers typecheck, lint
    and `check:*`.
  - `npm run check:test-projects -- <dir>` (local, fast) names the project for a directory.
- Files stay under 400 lines and functions under 120 (`npm run check:size`, local, fast).
- Every changeset is `patch`. Breaking changes are said in prose. Never write a `bump-approved`
  marker.
- No `export * from '@weasel-js/<pkg>'`. Re-export by name.
- Every package's imports are declared in its manifest (`check:imports`).
- Follow `CLAUDE.md`'s comment rule: comments only for what the code cannot say.
- Reach is in screen px. The single kit setting is `targets.snapPx`, default `8`. The grid's reach
  is `Infinity`.
- Modifier roles:
  - `snap.suspend` defaults to `['ctrl']`.
  - `snap.constrain` defaults to `['shift']`.
  - Path-edit handle drags do not declare `snap.suspend`.
- Ranking keys, in order:
  1. codimension within `H`, higher first;
  2. target-tier codimension, higher first;
  3. screen displacement, smaller first;
  4. stable source order.
- Commits are imperative, present tense, and end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Zoomed far out** (scale 0.05): the grid's lines are under 1px apart on screen. Snapping must
  stay stable and must not jitter between lines. The test goes in Task 5.
- **Many nodes** (2,000 siblings): candidate collection must cull by reach before the resolver
  runs, and one `at()` must stay under 2 ms in the unit benchmark. The test goes in Task 5.
- **Degenerate geometry:** a zero-size subject, two coincident guides, and a 3D camera looking
  straight down `up` (ground plane edge-on). None may produce NaN. Tests go in Task 1 and Task 11.
- **Suspend held mid-gesture, then released:** the next frame snaps again, and the readout clears
  while suspended. The test goes in Task 6.
- **Gesture canceled** (Escape) or the pointer leaves the canvas: `end()` runs and the readout
  clears. The test goes in Task 6.

---

### Task 1: The resolver in `@weasel-js/geom/nd`

**Files:**
- Create: `packages/geom/src/snap/flat.ts`, `packages/geom/src/snap/resolve.ts`,
  `packages/geom/src/snap/resolve.test.ts`, `packages/geom/src/snap/flat.test.ts`
- Modify: `packages/geom/src/nd/index.ts` (export both)
- Modify: `packages/geom/src/3d/vec3.ts`, `packages/geom/src/3d/ray3.ts`,
  `packages/geom/src/3d/index.ts`:
  - export `vec3`, `distance`, `lerp`, `pointOnRay`, `aabbOfPoints`, `closestPointOnLine`,
    `closestPointOnSegment`, `closestPointsRayLine`;
  - move `pointOnRay`/`aabbOfPoints` out of `packages/kernel3d/src/deps.ts`, which then imports
    them.

**Interfaces — Produces:**
```ts
// flat.ts
export type Vec = readonly number[];
export interface Flat { at: Vec; dirs: readonly Vec[] }          // affine subspace; dirs need not be orthonormal
export function flatDim(f: Flat): number;                         // rank of dirs
export function closestOnFlat(f: Flat, p: Vec): Vec;
export function intersectFlats(a: Flat, b: Flat, eps?: number): Flat | null;
export function closestBetweenFlats(a: Flat, b: Flat): { onA: Vec; onB: Vec };
// resolve.ts
export type SnapTier = 'target' | 'fallback';
export type ProbeRole = 'origin' | 'box' | 'geometry' | 'pointer';
export interface SnapProbe { id: string; at: Vec; role: ProbeRole }
export interface SnapCandidate<M> {
  probe: string;                    // SnapProbe.id
  locus: Flat;
  span?: readonly (readonly [number, number])[];   // one interval per locus dir, in units of that dir
  source: string; order: number;    // order = stable tiebreak
  tier: SnapTier; reachPx: number; required?: boolean; mark?: M;
}
export interface SnapProblem<M> {
  probes: readonly SnapProbe[];
  input: Flat;                      // H, in δ-space
  delta0: Vec;
  candidates: readonly SnapCandidate<M>[];
  toScreen(world: Vec): Vec;        // world → screen px
  poolSize?: number;                // default 24 per probe
  eps?: number;                     // default 1e-6
}
export interface SnapResolution<M> {
  delta: Vec;                       // closestOnFlat(input, delta0) when nothing snaps
  members: readonly SnapCandidate<M>[];
  satisfied: readonly SnapCandidate<M>[];   // every in-reach candidate the result meets (marks come from these)
  codim: number;
}
export function resolveSnap<M>(problem: SnapProblem<M>): SnapResolution<M>;
```

- [ ] **Step 1: Write failing tests** in `flat.test.ts`:
  - `closestOnFlat` projects onto a 2D line and a 3D plane;
  - `intersectFlats` of two crossing 2D lines is a point, of parallel lines is `null`, and of two
    3D planes is a line;
  - `closestBetweenFlats` of a skew ray-line pair in 3D.
- [ ] **Step 2: Write failing tests** in `resolve.test.ts`:
  - `point beats a nearer line`: a point locus 6px away and a line 2px away, with reach 8. The
    result is the point, `codim === 2`.
  - `two lines on different probes combine`: x from the probe `box.min` to line x=10, y from the
    probe `box.max` to line y=20. Both apply.
  - `fallback never displaces a target`: an unlimited-reach grid line at 1px and a target line at
    7px on the same axis. The target wins. On the other axis the grid fills in.
  - `nothing in reach returns delta0 projected into H`: H is a 45° line, so δ0 (3,1) becomes
    (2,2).
  - `H intersection`: H is a 15° line through the origin, plus a vertical guide in reach. The
    result is the intersection.
  - `span rejects off-segment solutions`.
  - `required forces a member`: 1D, steps every π/12 as `required`.
  - `degenerate`: a zero-length dir, coincident lines, and a NaN in `toScreen` output. All must
    return finite numbers.
  - `satisfied lists every coincident in-reach candidate`.
- [ ] **Step 3: Run** `onto do -in weasel-snap-arc -- npx vitest run --project=<geom's project> packages/geom/src/snap`.
  Expect FAIL (module not found).
- [ ] **Step 4: Implement `flat.ts`.** Use dense Gram-Schmidt on `dirs`. Intersect by solving
  `a.at + A s = b.at + B t` by least squares, and accept the result when the residual is under
  `eps`.
- [ ] **Step 5: Implement `resolveSnap`:**
  1. For each candidate, compute `δ_c = closestOnFlat(intersect(H, C_c), delta0)`, where
     `C_c = { at: locus.at − probe.at, dirs: locus.dirs }`.
  2. Keep a candidate when `|toScreen(probe+δ_c) − toScreen(probe+δ0)| ≤ reachPx` and the span
     holds.
  3. Pool the nearest `poolSize` per probe.
  4. Enumerate combinations of up to `flatDim(H)` members by DFS. Each member must strictly
     raise the codimension and keep every member in reach.
  5. Rank by the Global Constraints keys. When any `required` candidate exists, discard
     combinations without one.
- [ ] **Step 6: Implement the 3D helpers.** Add tests to `packages/geom/src/3d/3d.test.ts` for
  `closestPointsRayLine` (skew and parallel) and `closestPointOnSegment` (clamped ends).
- [ ] **Step 7: Run** the geom tests plus `packages/kernel3d` tests on onto. Expect PASS.
- [ ] **Step 8: Commit** `add a dimension-generic snap resolver to geom/nd and the 3D closest-point helpers`.

### Task 2: Core snap contract, 2D session, dep, store, roles, setting

**Files:**
- Create in `packages/core/src/features/snap/`:
  - `types.ts` (SnapSource, SnapCandidate, Locus, SnapMark, SnapCollect)
  - `roles.ts` (SNAP_ROLES)
  - `probes2d.ts`
  - `inputSubspace.ts`
  - `session2d.ts`
  - `outcomeStore.ts`
  - `registry.ts` (source list, `useSnapSource`)
  - tests beside each
- Modify:
  - `packages/core/src/interactions/actions/snapDep.ts`: add `begin`; keep `point`/`toTargets`/`release` until Task 13.
  - `packages/core/src/canvas/deps/snap.ts`: implement `begin` from registered sources.
  - `packages/core/src/kitSettings.ts`, `kitSettingsSchema.ts`: add `targets.snapPx` = 8.
  - `canvas/SceneCanvas.tsx` + its props type: `snap?: { sources?: readonly SnapSource[]; reachPx?: number; readout?: boolean }`.
  - `canvas/SceneCanvas/features.ts`: `FeaturePreset.snapSources?: readonly SnapSource[]`, composed like `moveBehaviors`.
  - `packages/core/src/index.ts`: public exports.

**Interfaces — Consumes:** Task 1's `resolveSnap`, `Flat`, `ProbeRole`.

**Interfaces — Produces:**
```ts
// types.ts
export interface Locus<P = Point> { at: P; dirs: readonly P[]; span?: readonly (readonly [number, number])[] }
export interface SourceCandidate<P = Point> { probe: string; locus: Locus<P>; required?: boolean; mark?: SnapMark<P> }
export type SnapGesture = 'point' | 'move' | 'resize' | 'rotate';
export interface SnapCollect<P = Point> {
  gesture: SnapGesture;
  probes: readonly { id: string; at: P; role: ProbeRole }[];   // at δ0
  exclude: readonly string[]; include?: readonly string[];
  origin?: P; also?: SnapGeometry;
  reachWorld(px: number): number;   // a cull radius in world units
  scene: SceneReader;               // whatever core already passes deps for reading nodes
}
export interface SnapSource<P = Point> {
  id: string; tier?: SnapTier; reachPx?: number;
  roles: readonly ProbeRole[];      // probe roles it matches; probes of other roles are not offered
  gestures?: readonly SnapGesture[];// default: all but 'rotate'
  collect(q: SnapCollect<P>): Iterable<SourceCandidate<P>>;
  angles?(q: AngleCollect): Iterable<AngleCandidate>;   // rotate and handle drags; see Task 8
}
export type SnapMark<P = Point> =
  | { kind: 'point'; at: P; glyph: string; label?: string }
  | { kind: 'line'; from: P; to: P }
  | { kind: 'gap'; from: P; to: P; value: number }
  | { kind: 'distance'; from: P; to: P; value: number };
// snapDep.ts (additions)
export type SnapConstrain = { step: number } | 'aspect' | 'axis';
export interface SnapBegin { gesture: SnapGesture; press: Point; ids?: readonly string[]; handle?: ResizeHandleId;
  pivot?: Point; origin?: Point; also?: SnapGeometry; constrain?: SnapConstrain }
export interface SnapMods { suspend: boolean; constrain: boolean }
export interface SnapOutcome { point: Point; held: boolean; marks: readonly SnapMark[] }
export interface SnapSession {
  at(p: Point, mods: SnapMods): SnapOutcome;
  angle(theta: number, mods: SnapMods): { theta: number; marks: readonly SnapMark[] };
  end(): void;
}
export interface SnapDep { begin?(req: SnapBegin): SnapSession; /* old members until Task 13 */ }
// roles.ts
export const SNAP_ROLES: { 'snap.suspend': ModifierRole; 'snap.constrain': ModifierRole };
export const snapMods: (ctx: { roles?; modifiers }) => SnapMods;   // built on roleReader(SNAP_ROLES)
// outcomeStore.ts
export interface SnapOutcomeStore { get(): readonly SnapMark[]; set(m: readonly SnapMark[]): void; subscribe(l: () => void): () => void }
// registry.ts
export function useSnapSource(source: SnapSource): void;
```

`probes2d.ts`, `buildProbes(gesture, req, scene, descriptor)`:
- `pointer`: the press point, for `point`; the dragged corner or edge midpoint for `resize`.
- `origin`: each subject's pose origin through its `OriginProjection` (see
  `features/paths/originProjection.ts`).
- `box`: the min, center and max corners of the subjects' union drawn box. Use the same box
  `alignMoveBehavior` reads today (`frames.drawnBounds`).
- `geometry`: the path base point that `captureMovePathSnap` picks today (`include: ids`).

`inputSubspace.ts`, `inputFlat(req, mods, delta0): Flat`. Choose `H` by case:
- **free:** the whole plane.
- **`{step}`:** the line at the nearest step angle from `origin`.
- **`axis`:** horizontal, vertical or 45°, whichever is nearest to δ0.
- **`aspect`:** the diagonal through the fixed corner.
- **edge handle:** the handle's axis.

`constrain` applies only while `mods.constrain`, except edge handles, which are always
constrained.

- [ ] **Step 1: Failing tests:**
  - `session2d.test.ts`:
    - a grid-like fake source plus a fake point source: `at()` returns the point when in reach,
      otherwise the grid;
    - `suspend` returns the raw point projected into `H`, with no marks;
    - `end()` clears the store;
    - probe roles filter what each source is offered.
  - `inputSubspace.test.ts`: each `H` case.
  - `probes2d.test.ts`: a rect with stroke width 10 yields box probes on the drawn box and the
    origin probe on the pose origin.
  - `snap.test.tsx`, through `<SceneCanvas snap={{ sources }}>`: an action that calls
    `deps.snap.begin` sees those sources, and a `FeaturePreset.snapSources` composes with them.
- [ ] **Step 2: Run on onto, expect FAIL.**
- [ ] **Step 3: Implement.**
  - `session2d.at()`:
    1. `delta0 = p − press`.
    2. Collect from every source whose `gestures` and `roles` match. Map each to a geom
       `SnapCandidate` (`reachPx = source.reachPx ?? kit targets.snapPx ?? 8`).
    3. Resolve with `toScreen` = the view transform.
    4. Write `satisfied` marks to the store, and return `press + delta`.
  - `held` is true when `members` is non-empty.
- [ ] **Step 4: Run on onto, expect PASS.** `npm run check:size` must be clean.
- [ ] **Step 5: Commit** `add the snap source contract and a session-shaped snap dep to core`.

### Task 3: Path and measure-end sources

**Files:**
- Modify:
  - `packages/core/src/features/paths/pathSnap/pathSnapper.ts`: becomes `pathSnapSource(opts: { kinds?: Partial<Record<PathSnapKind, boolean>>; reachPx?: number }): SnapSource`.
  - `snapGeometry.ts`: keep it.
  - `packages/core/src/features/measure/measureHit.ts`: add `measureEndSource(): SnapSource`.
- Test: `pathSnapSource.test.ts`, `measureEndSource.test.ts`.

**Interfaces — Consumes:** Task 2's `SnapSource`, `SnapCollect`.

**Interfaces — Produces:**
- `pathSnapSource`, roles `['pointer', 'geometry']`, tier `target`. It emits one point locus per
  `findPathSnap` hit kind in range, with mark `{ kind: 'point', glyph: <PathSnapKind>, label: PATH_SNAP_LABELS[kind] }`.
  - tangent/perpendicular need `q.origin`.
  - `nearest` is emitted only when no other kind is in range for that probe.
  - It honors `include` (for move's base point) and `also`.
- `measureEndSource`, roles `['pointer']`. It emits a point per measure end, with mark glyph
  `'center'`.

- [ ] **Step 1: Failing tests:**
  - Port each case in `pathSnapper.test.ts` to the source plus `resolveSnap`: the anchor beats the
    midpoint at equal distance through `order`, and `tangent` from an origin.
  - A measure end within 8px is snapped to, and one beyond it is not.
- [ ] **Step 2: Run, FAIL. Step 3: Implement. Step 4: Run, PASS.**
- [ ] **Step 5: Commit** `turn path snap and measure ends into snap sources`.

### Task 4: The readout layer

**Files:**
- Create: `packages/core/src/features/snap/readoutLayer.ts`, `readoutDraw.ts` (line, tick, gap-label
  and glyph commands; reuse `pathSnapGlyph` and `textCommand`), and tests.
- Modify: `canvas/SceneCanvas/useSceneCanvasLayers.ts`. Mount `snapReadout` in place of
  `pathSnapMarker` when `snap.readout !== false`.
- Modify: `packages/guides/src/spacingHints/distanceReadout.ts`. It writes `distance` marks into
  the outcome store (reached through a new `snapReadout` dep) instead of mounting a guides layer.

**Interfaces — Produces:**
- `createSnapReadoutLayer(store: SnapOutcomeStore, style?: SnapReadoutStyle): RenderLayer`:
  screen space, `alwaysOn`, subscribes to the store.
- `SnapReadoutStyle { color?; gapColor?; lineWidth? }`.
- The `snapReadout` dep: `{ store: SnapOutcomeStore }`, declared in `DepSchema`.

- [ ] **Step 1: Failing tests:**
  - Each mark kind produces the expected command kinds at the expected screen coordinates, under
    a view of scale 2 offset (10, 20).
  - An empty store draws nothing.
  - `distanceReadout` with Alt held writes one `distance` mark, and clears it on release.
- [ ] **Step 2: Run, FAIL. Step 3: Implement. Step 4: Run, PASS.**
- [ ] **Step 5: Commit** `draw every snap mark from one readout layer`.

### Task 5: Guides sources

**Files:**
- Create in `packages/guides/src/sources/`: `grid.ts`, `guides.ts`, `alignment.ts`, `spacing.ts`,
  `index.ts`, and tests.
- Modify:
  - `packages/guides/src/spacingHints/preset.ts`: `createSpacingHintsPreset` returns
    `snapSources` (spacing on by default, alignment off) plus the distance readout. It drops
    `moveBehaviors` and its marks overlay.
  - `packages/guides/src/index.ts`: export the sources.

**Interfaces — Consumes:** Task 2's types; the existing `roundToGridOn`, `deriveAlignmentGuides`,
`measureGaps` and `matchSpacing` math (reused, not copied).

**Interfaces — Produces:**
- `gridSnapSource({ spacing: number | { x: number; y: number }; origin?: Point; unitSystem? }): SnapSource`
  - Roles `['origin', 'pointer']`, tier `fallback`, `reachPx: Infinity`.
  - Per probe and axis it emits the two nearest grid lines (plane-aware).
- `guideSnapSource(getGuides: () => readonly Guide[]): SnapSource`: roles `['origin', 'pointer']`,
  one line per guide in cull range.
- `alignmentSnapSource(opts: { page?: boolean; getCandidates?: ... }): SnapSource`
  - Roles `['box', 'pointer']`.
  - Lines at sibling min/center/max per axis.
  - Mark `line` from the probe's box edge to the farthest aligned sibling's edge.
- `spacingSnapSource(opts?): SnapSource`
  - Roles `['box']`, gestures `['move', 'resize']`.
  - Lines where a gap equals an existing gap, or centers between neighbors.
  - Marks: one `gap` per equal gap, with `value`.

- [ ] **Step 1: Failing tests:**
  - **Port the behavior cases from** `behaviors/move/snapToGrid.test.ts`,
    `behaviors/*/snapToGuides.test.ts`, `guides/alignment/*.test.ts`, `planeSnap.test.ts` and
    `strategies/*.test.ts`. Each becomes "source + session2d gives the same pose as the old
    behavior did".
  - **Spec change:** alignment within reach beats the grid on its axis. Today they add.
  - **Zoom stability:** at scale 0.05, grid spacing 10, sweeping the pointer by 0.1px steps gives
    a monotonic snapped x.
  - **Culling:** 2,000 siblings in a row. `at()` offers the resolver at most `poolSize`
    candidates per probe, and the loop of 100 `at()` calls takes under 200 ms. That is the
    benchmark assertion; skip it in CI only if it is flaky, and say so in the test.
- [ ] **Step 2: Run, FAIL. Step 3: Implement. Step 4: Run, PASS.**
- [ ] **Step 5: Commit** `turn grid, ruler guides, alignment and equal spacing into snap sources`.

### Task 6: Move

**Files:**
- Modify:
  - `packages/core/src/interactions/actions/move/session.ts`: `snapSession = deps.snap.begin?.({ gesture: 'move', ids, press })`.
  - `frame.ts`: `delta = snapSession.at(pointer, snapMods(ctx)).point − press` before the
    behaviors. Behaviors no longer gate on `held`.
  - Move commit/cancel: `end()`.
  - The move action's `modifierRoles`: add `SNAP_ROLES`. `constrain: 'axis'` is passed in `begin`.
- Delete: `move/pathSnap.ts` and its test.
- Test: `move/snap.test.ts`.

**Interfaces — Consumes:** Task 2's `SnapDep.begin`, `snapMods`, `SNAP_ROLES`.

- [ ] **Step 1: Failing tests:**
  - A path anchor of another node within 6px captures the dragged shape's own anchor.
  - A grid source snaps the origin.
  - Alignment beats the grid on x while the grid holds y.
  - Ctrl held: no snap, and the store is empty. Ctrl released: the next frame snaps.
  - Shift: an axis lock to horizontal when |dx| > |dy|.
  - Escape cancels, then the store is empty.
  - Container dwell behaviors still run.
- [ ] **Step 2: Run, FAIL. Step 3: Implement. Step 4: Run, PASS.**
- [ ] **Step 5: Commit** `snap move through the snap session`.

### Task 7: Resize

**Files:**
- Modify:
  - `packages/core/src/interactions/actions/resize/{capture.ts, frame.ts, commit.ts}`: add `snap`
    to `requires`. Run `begin({ gesture: 'resize', ids, handle, constrain: 'aspect' })`. Snap the
    pointer before `computeProposedBounds`. Shift's aspect lock now comes from `H`, through the
    `snap.constrain` role.
  - `resize/behaviors/lockAspect.ts`: delete if nothing else reads it. `DEFAULT_RESIZE_BEHAVIORS`
    loses it.
- Delete: `resize/pointSnap.ts`, `PointSnapBehavior`, `PointSnapFrame`, `PointSnapContext`
  (`gestures/types.ts`), and `resizePolicy.pointSnap`.
- Test: `resize/snap.test.ts`.

- [ ] **Step 1: Failing tests:**
  - Dragging the right edge to within 5px of a guide lands on the guide. The left edge stays.
  - Corner plus Shift plus a vertical guide: the box keeps its aspect and its corner lands on the
    guide (the `H` intersection).
  - The grid snaps the dragged corner.
  - A rotated pose's dragged corner aligns to a sibling edge (replaces `matchRotatedCorners`
    coverage).
  - Edge-handle drags never move along the other axis.
- [ ] **Step 2: Run, FAIL. Step 3: Implement. Step 4: Run, PASS.**
- [ ] **Step 5: Commit** `snap resize through the snap session and make aspect lock a snap constraint`.

### Task 8: Rotate and the 1D angle path

**Files:**
- Modify:
  - `features/snap/session2d.ts`: implement `angle()` with `resolveSnap` in one dimension.
    `toScreen(θ) = [θ * radiusPx]`, where `radiusPx` is the screen distance from the pivot to the
    press.
  - `features/snap/types.ts`:
    - `AngleCollect { pivot: Point; theta0: number; ids; mods }`
    - `AngleCandidate { angle: number; required?: boolean; mark?: SnapMark }`
  - `packages/core/src/interactions/actions/rotate/{session,frame}.ts`: `begin({ gesture: 'rotate', ids, pivot })`, then `angle()`.
  - `rotate/behaviors/snapRotation.ts`: delete. `DEFAULT_ROTATE_BEHAVIORS` loses it.
- Create: `features/snap/rotationSource.ts`, `rotationSnapSource(): SnapSource` with these
  `angles()`:
  - multiples of π/2 (target);
  - other nodes' rotations (target);
  - while constrained, every π/12 as `required`.
  - Registered by default in `SceneCanvas`.
- Test: `rotate/snap.test.ts`.

- [ ] **Step 1: Failing tests:**
  - Rotating to 88° snaps to 90°.
  - Rotating to 80° does not (reach 8px at radius 50px is about 9°).
  - Shift at 50° snaps to 45°.
  - A sibling at 30°: rotating to 31° gives 30°.
  - Ctrl suspends.
- [ ] **Step 2: Run, FAIL. Step 3: Implement. Step 4: Run, PASS.**
- [ ] **Step 5: Commit** `snap rotation through the snap session`.

### Task 9: Insert, measure, symmetry center

**Files:**
- Modify:
  - `interactions/actions/insert/{session,frame}.ts`: `begin({ gesture: 'point', press, constrain: kind === 'line' ? { step: Math.PI / 12 } : undefined })`. Move the start with `carryStart` through a second `at()`.
  - `insert/geometry.ts`: delete `snapTo15Degrees`/`snapToAngleStep`/`SHIFT_ANGLE_STEP` once
    unused. `effectiveOriginMode` stays.
  - `features/measure/measureGestures.ts`: `point` sessions, with the start and the end each
    their own `at()`. Shift becomes `{ step }` in `H`.
  - `packages/symmetry/src/handleDrag.ts`: a `point` session.
  - `dragRect.ts`, `dragRadial.ts`: drop `snapPoint`.
  - Delete `packages/guides/src/behaviors/insert/*`.
- Test: `insert/snap.test.ts`, `measure/snap.test.ts`, `symmetry/handleDrag.test.ts`.

- [ ] **Step 1: Failing tests:**
  - A rect insert starts on a grid point and ends on a sibling's edge.
  - Line insert with Shift lands where the 15° line meets a guide.
  - Measure with Shift on a path anchor works the same way.
  - The symmetry center snaps to a path anchor.
- [ ] **Step 2: Run, FAIL. Step 3: Implement. Step 4: Run, PASS.**
- [ ] **Step 5: Commit** `snap insert, measure and the symmetry center through point sessions`.

### Task 10: Pen, spiro, anchor drags, handle snap

**Files:**
- Modify:
  - `tools/builtin/pen/usePenTool.ts`: placement and close through a `point` session, with
    `origin` = last anchor.
    - `nearestPathAnchor` is no longer called; `pathSnapSource` covers anchors.
    - Remove the `snapPoint` and `anchorSnapRadius` options.
    - Handle placement uses `constrain: { step: Math.PI / 4 }` in place of `constrainTo45`.
  - `penHandle.ts`: reflect that. Delete `util/constrainTo45.ts` if unused.
  - `packages/path-tools/src/spiro/useSpiroTool.ts`: same as the pen.
  - `edit-anchors/action.ts`: `anchorDragSnap` becomes a `point` session with `ids: [id]` and
    `also: still`.
  - `path-tools/src/handleSnap/handleSnap.ts`: the extension calls `session.angle()` in polar
    coordinates about the anchor, keeping the length. `handleSnapSource({ stepDeg = 45, reachDeg = 6 })`
    contributes the step angles and the opposite handle's angle.
    - The `role: 'snap'` overlay is replaced by readout `line` marks.
    - `EDIT_ANCHORS_ROLES` gains `snap.constrain` only (no `snap.suspend`).
    - `handle.holdAngle` makes the current angle `required`.
- Test: the existing pen, spiro, edit-anchors and handleSnap tests ported, plus:
  - pen Shift handle at 40° lands at 45°;
  - an anchor drag snaps to another path's midpoint;
  - a handle drag with Ctrl holds its length *and* still snaps its angle.

- [ ] **Step 1: Failing tests (above). Step 2: Run, FAIL. Step 3: Implement. Step 4: Run, PASS.**
- [ ] **Step 5: Commit** `snap pen, spiro, anchor drags and handle drags through the snap session`.

### Task 11: kernel3d

**Files:**
- Create in `packages/kernel3d/src/`:
  - `snap/session3d.ts`, `snap/probes3d.ts`, `snap/sources.ts`, `snap/marks.ts`
  - `project.ts`: `projectPoint(p: Vec3, viewport: Viewport3d): Point | null`, built on
    `transformPoint4` and `ndcToScreen`.
  - tests
- Modify:
  - `deps.ts`: `createSnap(world, opts?: { sources?: readonly SnapSource<Vec3>[]; reachPx?: number; store?: SnapOutcomeStore<Vec3> }): SnapDep`
    replaces the identity.
  - `index.ts`: exports.
  - `packages/labkit/examples/3d-lab/SolidInstrument.tsx` and `renderer3d.ts`: mount
    `boxSnapSource`, `alignPlaneSource` and `groundGridSource({ step: 1 })`, and draw
    `projectSnapMarks` lines and points beside the chrome boxes.

**Interfaces — Produces:**
```ts
export function boxSnapSource<TData, TLayer extends string>(world: World3d<TData, TLayer>): SnapSource<Vec3>;   // corners, edge segments (span), faces (span), centers
export function alignPlaneSource<TData, TLayer extends string>(world: World3d<TData, TLayer>): SnapSource<Vec3>; // planes x|y|z = min/center/max of each box
export function groundGridSource(opts: { step: number; up?: Vec3 }): SnapSource<Vec3>;   // fallback, reach Infinity, lines on up·p = 0
export function projectSnapMarks(marks: readonly SnapMark<Vec3>[], viewport: Viewport3d): { lines: ScreenLine[]; points: ScreenPoint[] };
```

Session details:
- For `move`, the probes are the subject's world AABB: 8 corners and the center (role
  `geometry`), and min/center/max (role `box`).
- `H` = the plane through the origin with normal `up`, which is the δ-space of `translate`.
- δ0 = the world delta that `translate(pose, screen delta)` would produce: the ray through the
  pointer, intersected with the plane through the press point.
- `at()` returns `projectPoint(pressWorld + δ)` as the screen point. Because `translate` re-casts
  that point onto the same plane, the round trip is exact. Assert it.
- For `point` (insert), `H` is the ground plane, and `press` is cast onto it.
- `toScreen` = `projectPoint`. An unprojectable point counts as out of reach.

- [ ] **Step 1: Failing tests:**
  - Moving a box so its corner comes within 5px of another box's corner snaps the corners
    together, and the screen round trip through the descriptor's `translate` lands it exactly
    (1e-6).
  - Alignment plane: two boxes at the same height. Dragging one makes its min-x snap to the
    other's min-x plane while depth stays free.
  - The ground grid snaps an insert footprint corner to an integer grid point.
  - Camera looking straight down `up` (pitch at `MAX_PITCH`): no NaN, and moves still snap.
  - A target behind the camera is never chosen.
  - `projectSnapMarks` drops marks that do not project.
- [ ] **Step 2: Run, FAIL. Step 3: Implement. Step 4: Run, PASS.**
- [ ] **Step 5: Commit** `snap kernel3d moves and inserts to boxes, alignment planes and a ground grid`.

### Task 12: apps/draw, site demos, labkit

**Files:**
- `apps/draw/src/useGrid.ts`: return `gridSnapSource(...)` when `view.snapToGrid`. Delete the
  hand-written `snapPoint` and the `selectTool.snap` wiring.
- `apps/draw/src/useSpacingHints.ts`: compose the preset (now source-based).
- `apps/draw/src/Workspace.tsx`: `measureEndSource()` replaces `snapTargets`. Pass
  `snap={{ sources }}`.
- Site demos, each moved to sources (`apps/site/demos/`):
  AlignmentGuides, SpacingHintsLab, PathSnapLab, HandleSnapLab, PointSnap (now "Resize snap": the
  grid on resize corners), MeasureLab, SceneLab, DebugOverlay, PathPose, Text, Transform, Layout,
  KitSettings (`targets.snapPx`).
- `apps/site/registry.ts`: update its entries.
- `packages/labkit/examples/weasel-lab/SceneInstrument.tsx`: grid source.

- [ ] **Step 1:** Make the edits. Each demo stays terse (`CLAUDE.md` demo conventions).
- [ ] **Step 2:** Commit, then `npm run test:fleet`. Expect green apart from Task 13's remaining
  old-API tests.
- [ ] **Step 3: Visual check.**
  - Start the site dev server in the background with `WAKE_EXTRA=<free port>`.
  - With the headless playwright MCP, drag a shape near a sibling in AlignmentGuides and in draw,
    and screenshot the readout.
  - Post every screenshot with `transom post <file>` to the zone `snap-arc`.
  - Stop the server.
- [ ] **Step 4: Commit** `move draw, the site demos and labkit onto snap sources`.

### Task 13: Remove the old pathways, docs, changesets

**Files:**
- **Delete from core:**
  - `SnapDep.point`/`toTargets`/`release`. `begin` becomes required.
  - `SnapQuery`.
  - `useSnapDepSource`'s `SnapSources`.
  - `toolOptions.snapPoint`/`snapTargets`/`pathSnap`, and `PathSnapOptions` where unused.
  - `usePathSnapper`.
  - `createPathSnapMarkerLayer`.
  - `DEFAULT_PATH_SNAP_RADIUS`.
  - `interactions/gestures/shared/snap.ts` (`SnapStrategy`, the `snap()` adapter).
  - `selectTool.snap`.
  - `targets.penAnchorSnapPx` (core kit settings and schema).
- **Delete from guides:**
  - `strategies/grid.ts` and `strategies/guides.ts`. Keep `onPlane.ts`, which the grid source
    uses.
  - `behaviors/{move,resize}/*`.
  - `alignMoveBehavior`/`alignInsertBehavior`/`alignResizeBehavior`. Keep the match math the
    sources use.
  - `targets.guideSnapPx` and `DEFAULT_GUIDE_TOLERANCE_PX`.
  - The `move`/`insert`/`resize` subpath files and their `package.json` exports.
- **Delete from geom:** `findPathSnap`'s own ranking, if nothing calls it any more. Keep the
  index.
- **Docs:**
  - Create `docs/snapping.md`: the durable reference.
    - the locus/probe/`H` model and the ranking keys;
    - how to write a source;
    - the roles;
    - 3D;
    - the "Calls made" list from the spec, kept as decisions.
  - Link it from `docs/taxonomy.md`'s gesture section and from `packages/guides/README.md`.
  - Fix any README or taxonomy text naming deleted symbols (`grep -rn` each deleted name across
    `docs/` `packages/*/README.md` `apps/`).
- **`docs/TODO.md`:**
  - Delete the P1 "Guides and snapping, designed as one arc" entry.
  - Rewrite any other entry naming deleted APIs.
  - Keep the P3 stroke-alignment question, and say it is now a one-line role change on the grid
    and guide sources.
  - Edit only lines about snapping; another session is editing other entries.
- **Changesets:** one `patch` changeset per touched package, or one listing them all. The prose
  states:
  - the breaking removals, each with its replacement;
  - that eric's `@weasel-js/core/move` `snapToGrid` import becomes `gridSnapSource`.
- **Delete** the spec and this plan once `docs/snapping.md` holds what is worth keeping.

- [ ] **Step 1:** Delete and fix references until `grep -rn "snapToTargets\|toTargets\|snapPoint\|guideSnapPx\|penAnchorSnapPx\|SnapStrategy\|pointSnapToGrid\|alignMoveBehavior" packages apps docs`
  is empty apart from `docs/snapping.md`'s history-free text.
- [ ] **Step 2:** Run `npm run check:size` locally. Commit, then run `npm run test:gate` and
  `npm run test:fleet` on onto. Both must be green; the fleet log must show the `fleet-tree` gate
  matching the SHA.
- [ ] **Step 3: Commit** `remove the old snap pathways and document the snap pipeline`.
