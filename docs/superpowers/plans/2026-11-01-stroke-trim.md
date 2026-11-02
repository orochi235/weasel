# Stroke Trim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `StrokeTrim` on `Stroke` that draws only part of a stroke in pen order, with markers riding
the window's ends, animatable per frame, exported baked, and passed through diagram edges.

**Architecture:** geom gets a dimension-free length table and position queries over component arrays;
stroke gets `resolveTrim` (trim → `[from, to]` arc lengths) and a polyline windower that the ribbon,
the marker heads, picking and the exporters all call. Per-frame animation goes through a trim override
table on the animator, read at draw time the way vertex-color overrides are.

**Tech Stack:** TypeScript, vitest (`weasel-ui`, `core`, `browser` projects), React for the demo.

**Spec:** `docs/superpowers/specs/2026-11-01-stroke-trim-design.md` — read it first; this plan argues
from it and does not restate its rules.

## Global Constraints

- `@weasel-js/paint` and `@weasel-js/geom` keep **no** `@weasel-js/*` dependencies.
- Lengths are path-space (world). No `{ px }` trim measure anywhere.
- New geom queries return component tuples `[x, y, z]`; 2D callers read z = 0. `geom/3d` wraps them as `Vec3`.
- Every changeset is `patch`. Never write a `bump-approved` marker.
- `npm run check:size`: no file over 400 lines, no function over 120.
- Run `npm ci` in the worktree before any build or test (CLAUDE.md trap: otherwise it builds against
  the main checkout's `node_modules`).
- Tests while iterating: one file at a time, `--maxWorkers=1`. Never `npm run test:gate`. The full run is
  the controller's batch `npm run test:fleet`, not this branch's.
- Tool and demo code follow CLAUDE.md's demo conventions (built on kit systems: animator, scene, `DiagramView`).

## Review Focus

1. **A trim on a path with rounded `corners`** — head and ribbon end must coincide; anchor positions in
   authored numbering. Test in Task 3 (`windows a cornered path in authored numbering`) and Task 4.
2. **A window that lands exactly on a subpath boundary or an anchor** — no zero-length run, no
   duplicated marker. Test in Task 3 (`a window ending at a subpath start draws nothing of it`).
3. **`start` ≥ `end`, NaN, or positions outside the path** — clamp; draw nothing for empty; never throw.
   Test in Task 2 (`resolveTrim clamps and empties`).
4. **A trimmed stroke whose dash is too fine** — dash still goes solid by the whole-path rule, and the
   phase anchoring does not change that decision. Test in Task 4 (`dash solid decision ignores trim`).
5. **A trimmed node that also has a fill, exported** — fill keeps the full outline; only the stroke is cut.
   Test in Task 7 (`fill keeps the whole outline under a trim`).

---

### Task 1: `StrokeTrim` type and `Stroke.trim`

**Files:**
- Create: `packages/paint/src/strokeTrim.ts`
- Modify: `packages/paint/src/paint.ts` (`Stroke`, after `dash`), `packages/paint/src/index.ts`
- Test: `packages/paint/src/strokeTrim.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TrimAt = number | { length: number } | { anchor: number } | { subpath: number };
  export type TrimPace = 'length' | 'anchor';
  export interface StrokeTrim { start?: TrimAt; end?: TrimAt; pace?: TrimPace }
  export function strokeTrimKey(trim: StrokeTrim | undefined): string; // '' for undefined; stable per value
  // Stroke gains: trim?: StrokeTrim
  ```

- [ ] **Step 1: Write the failing test** — `strokeTrimKey`: `undefined` → `''`; two structurally equal trims → equal
  keys; `{}` ≠ `{ start: 0 }`; `{ start: { anchor: 2 } }` ≠ `{ start: { length: 2 } }`;
  `{ end: 0.5 }` ≠ `{ end: 0.5, pace: 'anchor' }`.
- [ ] **Step 2: Run** `npx vitest run --project=weasel-ui packages/paint/src/strokeTrim.test.ts --maxWorkers=1` → FAIL (module missing).
- [ ] **Step 3: Implement** the types, the key, the `Stroke.trim` field with a one-line doc pointing at `StrokeTrim`, and the index export.
- [ ] **Step 4: Run** the test → PASS; `npm run typecheck:packages -- paint`.
- [ ] **Step 5: Commit** `add StrokeTrim and Stroke.trim`.

### Task 2: Length table and position queries (geom), `resolveTrim` (stroke)

**Files:**
- Create: `packages/geom/src/along/lengthTable.ts`, `packages/geom/src/along/positions.ts`,
  `packages/geom/src/3d/along3.ts`, `packages/stroke/src/trim/resolveTrim.ts`
- Modify: `packages/geom/src/index.ts`, `packages/geom/src/3d/index.ts`, `packages/stroke/src/index.ts`
- Test: `packages/geom/src/along/lengthTable.test.ts`, `packages/geom/src/3d/along3.test.ts`,
  `packages/stroke/src/trim/resolveTrim.test.ts`

**Interfaces:**
- Produces (geom root):
  ```ts
  export interface LengthRun {
    points: ArrayLike<number>;   // `dim` components per point
    closed: boolean;
    anchorA?: ArrayLike<number>; anchorB?: ArrayLike<number>; anchorT?: ArrayLike<number>;
  }
  export interface LengthTable {
    readonly dim: 2 | 3;
    readonly runs: readonly LengthRun[];
    readonly total: number;              // pen-order length, closing edges included
    readonly runStart: Float64Array;     // runs.length + 1 entries; last = total
    readonly segments: number;           // anchor-space range (spec: "The anchor measure, precisely")
  }
  export function lengthTable(runs: readonly LengthRun[], dim: 2 | 3, anchorSources?: Uint32Array | null): LengthTable;
  export function lengthAtAnchor(t: LengthTable, anchor: number): number;
  export function lengthAtSubpath(t: LengthTable, subpath: number): number;   // fractional = by length within it
  export function lengthAtSegmentFraction(t: LengthTable, f: number): number; // pace 'anchor'
  export function pointAtLength(t: LengthTable, s: number): { point: [number, number, number]; tangent: [number, number, number] };
  ```
- Produces (geom/3d): `pointAtLength3(t: LengthTable, s: number): { point: Vec3; tangent: Vec3 }`.
- Produces (stroke): `resolveTrim(t: LengthTable, trim: StrokeTrim | undefined): { from: number; to: number } | null`
  — `undefined` trim → `{ from: 0, to: total }`; empty window → `null`.

- [ ] **Step 1: Write the failing geom tests** in `lengthTable.test.ts`:
  - `measures an open L` — points `[0,0, 3,0, 3,4]`, open, anchors 0,1,2 → `total` 7, `lengthAtAnchor(t, 1)` 3,
    `lengthAtAnchor(t, 1.5)` 5, `segments` 2.
  - `counts a closed run's closing edge` — unit square closed, 4 anchors → `total` 4, `segments` 4,
    `lengthAtAnchor(t, 3.5)` 3.5.
  - `pen lift covers no distance` — two open runs `[0,0,1,0]` (anchors 0,1) and `[5,0,6,0]` (anchors 2,3) →
    `total` 2, `lengthAtAnchor(t, 1.5)` 1, `lengthAtSubpath(t, 1)` 1, `lengthAtSubpath(t, 1.5)` 1.5, `segments` 2.
  - `maps corner-expanded anchors to authored numbering` — an L whose corner anchor 1 expanded into
    anchors 1,2 (`anchorSources = [0,1,1,2]`) → `lengthAtAnchor(t, 1)` is the arc's midpoint length.
  - `pointAtLength gives point and unit tangent` — on the open L, `s = 5` → point `[3,2,0]`, tangent `[0,1,0]`.
  - `works in 3 components` — `dim 3` run `[0,0,0, 0,0,2]` → `total` 2, tangent `[0,0,1]`.
  - `lengthAtSegmentFraction is equal time per segment` — open L: `f = 0.5` → 3 (end of segment 0), `f = 0.75` → 5.
- [ ] **Step 2: Write the failing `resolveTrim` tests** in `resolveTrim.test.ts` (build tables with `lengthTable`):
  - `default trim is the whole path`; `fraction under length pace` (`end: 0.5` on the L → `to` 3.5);
    `fraction under anchor pace` (`end: 0.5, pace: 'anchor'` → `to` 3); `absolute measures ignore pace`;
  - `resolveTrim clamps and empties` — `start: -1` → `from` 0; `end: { length: 99 }` → `to` 7;
    `{ start: 0.6, end: 0.4 }` → `null`; `{ start: 0.5, end: 0.5 }` → `null`; `{ end: NaN }` → `null`.
- [ ] **Step 3: Run** both files (`--project=weasel-ui`) → FAIL.
- [ ] **Step 4: Implement** `lengthTable.ts` (table build + anchor/subpath/segment queries) and `positions.ts`
  (`pointAtLength`), the `along3.ts` wrapper, then `resolveTrim.ts`. Store per-run cumulative lengths and an
  authored-anchor breakpoint list internally (not on the public interface). For corner remap: authored anchor
  *n*'s length is the midpoint of the lengths of the expanded anchors whose source is *n*.
- [ ] **Step 5: Run** both → PASS; `npm run typecheck:packages -- geom stroke`.
- [ ] **Step 6: Commit** `add a dimension-free length table and resolveTrim`.

### Task 3: Windowing polylines

**Files:**
- Create: `packages/stroke/src/trim/windowPolylines.ts`
- Test: `packages/stroke/src/trim/windowPolylines.test.ts`

**Interfaces:**
- Consumes: `lengthTable`, `resolveTrim` (Task 2); `Polyline` from `@weasel-js/geom/tessellate`.
- Produces:
  ```ts
  export interface WindowedRun {
    polyline: Polyline;    // always closed: false; widths/offsets/anchorA/B/T interpolated at cuts
    fromClosed: boolean;   // cut from a closed subpath: no start/end markers
    dashPhase: number;     // distance the window cut from this subpath's start; 0 if uncut
  }
  export function polylineTable(polylines: readonly Polyline[], anchorSources?: Uint32Array | null): LengthTable;
  export function windowPolylines(polylines: readonly Polyline[], trim: StrokeTrim | undefined,
    anchorSources?: Uint32Array | null): WindowedRun[] | null; // null = no trim set: caller uses polylines as-is
  ```

- [ ] **Step 1: Write the failing tests**:
  - `no trim returns null`.
  - `cuts an open run at both ends` — L, `{ start: 0.25, end: 0.75 }` → one run, first point at length 1.75,
    last at 5.25, `fromClosed` false, `dashPhase` 1.75.
  - `cuts a closed run open` — square, `{ end: 0.5 }` → one run of 3 points ending at `[1,1]`, `fromClosed` true.
  - `a window ending at a subpath start draws nothing of it` — two runs, `{ end: { subpath: 1 } }` → exactly one run.
  - `windows a cornered path in authored numbering` — cornered L, `{ end: { anchor: 1 } }` → the run ends at
    the arc midpoint.
  - `interpolates widths at a cut` — run with `widths [2, 4]` over length 10, `{ start: 0.5 }` → first width 3.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Reuse geom's `trimPolyline` interpolation where it fits (`geom/src/tessellate/trim.ts`);
  it refuses closed runs, so open the closed run (append its first point) before cutting.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `window stroke polylines by a StrokeTrim`.

### Task 4: Ribbon, dash phase and marker heads

**Files:**
- Modify: `packages/stroke/src/tessellate/stroke.ts` (`tessellateStroke`), `packages/stroke/src/tessellate/dash.ts`
  (`dashPolylines`, `splitForDash`), `packages/stroke/src/markerHeads.ts`, `packages/stroke/src/markerSites.ts`
- Test: `packages/stroke/src/tessellate/strokeTrimWindow.test.ts`, `packages/stroke/src/markerHeads.trim.test.ts`

**Interfaces:**
- Consumes: `windowPolylines` (Task 3).
- Produces: `dashPolylines(polylines, pattern, phases?: readonly number[])`, `splitForDash(pl, pattern, phase = 0)`.
  `markerSites` takes the run's `fromClosed` so a run cut from a closed subpath gets no start/end site.

- [ ] **Step 1: Write the failing ribbon tests** (`strokeTrimWindow.test.ts`, with `spanX` as in `strokeTrim.test.ts`):
  - `draws only the window` — 100-unit line, `trim: { end: 0.5 }`, butt cap → x span `[0, 50]`.
  - `trims before marker insets` — same with `markerEnd: 'arrow'` → ribbon ends short of 50 by the inset
    `strokeInsets` gives for that marker.
  - `empty window draws nothing` — `{ start: 0.7, end: 0.2 }` → `vertices.length` 0.
  - `dash stays anchored to the subpath start` — dash `[10, 10]`, `{ start: 0.15 }` → first dash runs 15→20.
  - `dash solid decision ignores trim` — dash `[0.01, 0.01]` that `dashPattern` calls solid on the whole path →
    still solid under `{ end: 0.5 }`.
  - `rect under a stretching metric trims in world length` — a rect stroked with `opts.metric` set, `{ end: 0.5 }`
    → visible span is half the rect's world perimeter.
- [ ] **Step 2: Write the failing marker tests** (`markerHeads.trim.test.ts`):
  - `end head rides the window front` — line 0→100, `markerEnd: 'arrow'`, `{ end: 0.5 }` → head anchored at x 50, angle 0.
  - `mid markers appear only inside the span` — 4-anchor polyline, `markerMid: 'dot'`, `{ end: { anchor: 2 } }` →
    exactly one mid head (anchor 1); anchor 2 is an end.
  - `closed subpath cut gets no start/end head` — square, `markerEnd`, `{ end: 0.5 }` → no end head.
  - `head meets the ribbon on a cornered path` — cornered L, `{ end: { anchor: 1 } }` → head point equals the
    ribbon's last centerline point within 1e-6.
- [ ] **Step 3: Run** both → FAIL.
- [ ] **Step 4: Implement.** In `tessellateStroke`, window after `populateWidths` and before `trimInSpace`, measuring
  in world (for `rectInMetric`, build the table from world polylines, then map). Pass `resolved?.anchorSources`.
  In `markerHeads`, resolve corners as the ribbon does (`resolveCornersWithSources`) **only when `stroke.trim` is set**,
  window with the same call, and feed `fromClosed` to `markerSites`.
- [ ] **Step 5: Run** both, plus `stroke.test.ts`, `strokeTrim.test.ts`, `markerHeads.test.ts`, `strokeMarkers.test.ts` → PASS.
- [ ] **Step 6: Commit** `draw trimmed strokes and their heads`.

### Task 5: Renderer cache keys

**Files:**
- Modify: `packages/renderer/src/cache/strokeMeshCache.ts` (`configKey`), `packages/renderer/src/cache/markerCommandCache.ts`
- Test: `packages/renderer/src/draw.strokeCache.test.ts` (add cases)

- [ ] **Step 1: Write the failing tests** — `a trim change misses the ribbon cache` (same path and stroke, `trim.end`
  0.4 then 0.6 → two different `Mesh` objects); `an unchanged trim hits` (same `Mesh`); same pair for marker commands.
- [ ] **Step 2: Run** `--project=weasel-ui` → FAIL.
- [ ] **Step 3: Implement** — append `strokeTrimKey(stroke.trim)` to both keys.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `key stroke caches on the trim`.

### Task 6: Picking

**Files:**
- Modify: `packages/geom/src/pathHitTest.ts` (`StrokeHitTestOptions`, `strokeHitTest`),
  `packages/core/src/canvas/NodeShape.ts` (the `strokeHitTest` call and `findShapeInk`'s result)
- Test: `packages/geom/src/pathHitTest.span.test.ts`, `packages/core/src/canvas/NodeShape.trim.test.ts`

**Interfaces:**
- Produces: `StrokeHitTestOptions.span?: { from: number; to: number }` — pen-order world arc lengths; points
  near the path outside the span miss. geom stays free of `StrokeTrim`; core resolves the span with stroke's
  `polylineTable` + `resolveTrim`.

- [ ] **Step 1: Write the failing tests** — geom: 100-unit line, `span { from: 0, to: 50 }`, threshold 2 → hit at (25, 0),
  miss at (75, 0). core: a path node with `stroke.trim { end: 0.5 }` → `shapeCoversPoint` true at the visible half,
  false at the hidden half; with no trim, true at both.
- [ ] **Step 2: Run** (`weasel-ui` for geom, `core` for core) → FAIL.
- [ ] **Step 3: Implement.** A trim the animator overrides does not reach picking (spec, "Picking").
- [ ] **Step 4: Run** → PASS; also `npx vitest run --project=core packages/core/src/canvas/NodeShape*.test.ts --maxWorkers=1`.
- [ ] **Step 5: Commit** `pick only a stroke's visible span`.

### Task 7: SVG and PDF export bake the trim

**Files:**
- Create: `packages/stroke/src/trim/trimmedPath.ts`
- Modify: `packages/svg/src/fromKit.ts` and `packages/svg/src/strokeAttrs.ts`, `packages/svg/package.json` (add
  `@weasel-js/stroke`), `packages/pdf/src/strokeOps.ts` and its path-stroking caller
- Test: `packages/stroke/src/trim/trimmedPath.test.ts`, `packages/svg/src/fromKit.trim.test.ts`, `packages/pdf/src/strokeOps.trim.test.ts`

**Interfaces:**
- Produces: `trimmedPath(path: Path, trim: StrokeTrim | undefined): { path: Path; dashPhases: number[] } | null`
  — the visible span as a `PolygonPath` (curves split, not flattened), one open subpath per visible run;
  `null` for an empty window; the input path back with `[]` when `trim` is undefined.

- [ ] **Step 1: Write the failing tests**:
  - stroke: `keeps curves` — a single cubic, `{ end: 0.5 }` → result has one `C` command, its end point equal to
    `pointAtLength` at half length within 1e-3. `splits across subpaths` — two-subpath path, window across the gap →
    two `M`s.
  - svg: a path node with `trim { end: 0.5 }` and `markerEnd: 'arrow'` → output's stroked `d` ends at the half point,
    carries `marker-end`, and no `pathLength` attribute. `fill keeps the whole outline under a trim` — filled and
    stroked node → the fill element's `d` is the full path; the stroke is a separate element with the cut path.
    Dashed and trimmed → `stroke-dashoffset` equals the run's `dashPhase`.
  - pdf: trimmed dashed stroke writes the `d` operator with phase equal to `dashPhase`, and path ops for the cut path.
- [ ] **Step 2: Run** (`weasel-ui`) → FAIL.
- [ ] **Step 3: Implement.** Split curves at the span ends with geom's existing curve-splitting helpers (search
  `geom/src` for a de Casteljau split before writing one); the parameter comes from the flattened point's segment.
- [ ] **Step 4: Run** → PASS; existing `packages/svg/src/*.test.ts` touching strokes and `packages/pdf/src/strokeOps.test.ts` → PASS.
- [ ] **Step 5: Commit** `bake stroke trims into SVG and PDF output`.

### Task 8: Animated trims

**Files:**
- Create: `packages/animator/src/trimRegistry.ts`, `packages/core/src/canvas/trimOverrides.ts`
- Modify: `packages/animator/src/useAnimator.ts`, `packages/animator/src/types.ts` (`Animator`), `packages/animator/src/index.ts`,
  `packages/core/src/canvas/nodeShapeTypes.ts` (`NodePaintCtx`), `packages/core/src/canvas/nodeShapes/nodePaint.ts`,
  the three painters calling `withAnimatedVertexColors` (`pathPainter.ts`, `shapePainter.ts`, `derivedPainter.ts`),
  and the two wrap sites (`sceneSlotWiring.ts`, `sceneViewRender.ts`) plus `SceneCanvas.tsx` / `SceneViewCanvas.tsx`
  where `colorOverrides` is passed
- Test: `packages/animator/src/trimRegistry.test.ts`, `packages/core/src/canvas/trimOverrides.test.tsx`

**Interfaces:**
- Produces (animator; numbers only, no paint dependency):
  ```ts
  export interface TrimOverride { start?: number; end?: number } // fractions
  export class TrimOverrideRegistry {
    set(id: string, o: TrimOverride): void; clear(id: string): void; clearAll(): void;
    get(id: string): TrimOverride | undefined; has(id: string): boolean;
    target(id: string): Target<{ start: number; end: number }>; // tween/spring through the animator
    version(): number;
  }
  // Animator gains: trimOverrides: TrimOverrideRegistry
  ```
- Produces (core): `NodePaintCtx.trim?: (base: StrokeTrim | undefined) => StrokeTrim | undefined`;
  `withTrimOverrides(registry, drawOne)` beside `withColorOverrides`; `withAnimatedTrim(cmds, ctx)` beside
  `withAnimatedVertexColors`, applied in the same three painters. An override replaces `start`/`end` and keeps the
  base's `pace`.

- [ ] **Step 1: Write the failing tests** — animator: `target tweens end` (tween `end` 0→1 over 100 ms with a fake
  clock → `get(id).end` 0.5 at 50 ms); `clear drops the override`. core: a `SceneCanvas` path node with an animator
  whose `trimOverrides` sets `{ end: 0.5 }` → the painted command's `stroke.trim.end` is 0.5 and the scene node's
  data is unchanged; no undo entry.
- [ ] **Step 2: Run** (`weasel-ui` for animator, `core` for core) → FAIL.
- [ ] **Step 3: Implement**, mirroring `ColorOverrideRegistry` / `withColorOverrides`; a repaint follows `version()` as
  color overrides do.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `animate stroke trims through the animator`.

### Task 9: Diagram edges and the demo

**Files:**
- Modify: `packages/diagram/src/dataTypes.ts` (`EdgeStyle`), `packages/diagram/src/dataEdges.ts` (edge `stroke`)
- Create: `apps/site/demos/DiagramDrawOnDemo.tsx`; Modify: `apps/site/registry.ts`
- Test: `packages/diagram/src/fromData.trim.test.ts`

- [ ] **Step 1: Write the failing test** — an edge with `style.trim { end: 0.5 }` → its spec's `data.stroke.trim` equals it;
  without one, `data.stroke.trim` is absent.
- [ ] **Step 2: Run** (`weasel-ui`) → FAIL.
- [ ] **Step 3: Implement** `EdgeStyle.trim?: StrokeTrim` and pass-through.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Write the demo** — a small `DiagramView` whose edges draw on one after another with
  `animator.stagger(...)` over `trimOverrides.target(edgeNodeId)`; heads ride the fronts; a Replay button. Register it
  beside `DiagramEdgesDemo`.
- [ ] **Step 6: Verify headless** — run the site dev server (background), screenshot mid-animation and at rest with the
  playwright MCP, `transom post` both (zone `weasel`).
- [ ] **Step 7: Commit** `draw diagram edges on through a stroke trim`.

### Task 10: Finish

- [ ] **Step 1:** Write `.changeset/stroke-trim.md`, `patch` for paint, geom, stroke, renderer, svg, pdf, animator, core,
  diagram, describing the feature in prose.
- [ ] **Step 2:** Set the spec's Status line to built on `stroke-trim` with the date; delete this plan.
- [ ] **Step 3:** Run `npm run typecheck:packages -- paint geom stroke renderer svg pdf animator core diagram`,
  eslint on the changed files, `npm run check:size`, `npm run check:bumps` → all clean.
- [ ] **Step 4:** Commit `finish the stroke trim`, then report ready for the next batch.
