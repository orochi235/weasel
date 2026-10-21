# Controls Along an Arc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay `Slider` (and `DetentSlider`, `Jog` through it) and `Bar` out along a circular arc through one track-shape primitive, with a wrapper that hands the shape to whatever is inside it.

**Architecture:** The track shape and the reading run over it (flip, reversal, tip angle) are pure math in `@weasel-js/geom` (`packages/geom/src/track/`). `@weasel-js/ui` adds an `<Along>` wrapper that sizes an arc from its own box and provides it by context. `Slider` measures every pointer through a `SliderGeometry` built from its shape; a line keeps today's `left: %` placement and an arc places through custom properties. A curved `Bar` is a separate layout (`BarAlong`) over the same item list a straight bar draws with flex.

**Tech Stack:** TypeScript, React 19, CSS modules, SVG strokes, react-aria-components popovers, vitest (jsdom `weasel-ui` project, `browser` project in headless Chromium), forge stories.

**Spec:** `docs/superpowers/specs/2026-10-21-arc-controls-design.md` (read it with this plan; it is deleted in the last task).

## Global Constraints

- Work in a worktree: `git worktree add -b feat/arc-controls .claude/worktrees/arc-controls main`, then `npm ci` inside it before anything builds or tests.
- Angles in every public type are **degrees, clockwise from 12 o'clock, on a y-down plane** (screen and canvas). One convention for geom and ui.
- No inline styles beyond custom properties a stylesheet reads (`--at-x`, `--at-y`, `--at-angle`, `--row`); no `!important`. A straight slider's existing `style={{ left }}` stays as it is (existing tests pin it).
- `npm run check:size` holds: 400 lines per file, 120 per function. `SliderBody.tsx` (allowed 239) and `useThumbDrags.ts` (allowed 140) may only come down; run `npm run check:size -- --update` after splitting them.
- Every new export carries a TSDoc line (`check:undescribed`, `audit:jsdoc`). `@weasel-js/geom` stays React- and DOM-free (`check:react-free`).
- Anti-goal from the spec: no change to how a straight control looks or behaves. **Every existing test passes unedited**, except that a test building a `TrackCtx` by hand may add the new `shape` field.
- Comments only where the code cannot say it (repo rule "Comment sparingly").
- Single jsdom test file, locally: `npx vitest run --project=weasel-ui <file>` (geom's tests are in `weasel-ui` too). Browser tests, typecheck and anything wider go to the fleet on a commit: `npm run test:fleet -- HEAD` (valid only if its log has `fleet-tree: N changed path(s) match <sha>`), and before merging also `npm run test:fleet:postbuild -- HEAD`.
- jsdom lays nothing out and the CSS-module proxy answers any class name: layout, hit areas and stylesheet rules are proved only in `*.browser.test.tsx`.
- One changeset, every package `patch`; its prose says `TrackCtx` gained a required `shape` field.
- Commit subjects imperative, present tense; every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **A wrapper not yet laid out (0×0 box, hidden panel, jsdom):** nothing is placed at `NaN`; everything sits at the box's center until it measures. Test in Task 3.
- **An arc shorter than one thumb under `thumbFit: 'inside'`:** the half-thumb insets would cross; the value span collapses to the arc's middle instead of inverting. Test in Task 5.
- **The wrapper's box resizes (a lens zoomed or resized):** thumbs and items move onto the new rim. Test in Task 7 and Task 11.
- **An arc too short for any bar item in `'menu'` mode:** the More button sits alone at the run's center and holds every item. Test in Task 8.
- **Keyboard on a curved slider:** arrows, Page, Home and End step exactly as on a line. Test in Task 5.

---

### Task 1: Track shapes in geom (line and arc)

**Files:**
- Create: `packages/geom/src/track/shape.ts` (types, `lineShape`)
- Create: `packages/geom/src/track/arc.ts` (`arcShape`)
- Modify: `packages/geom/src/index.ts` (export block after the `nearest` line)
- Modify: `packages/geom/src/exports.test.ts` (add `lineShape`, `arcShape` to the name list)
- Test: `packages/geom/src/track/shape.test.ts`, `packages/geom/src/track/arc.test.ts`

**Interfaces:**
- Consumes: `Point` from `../paths/cubicMath`, `PathStation` from `../paths/pathMeasure`, `nearestOnLine` from `../nearest`.
- Produces:
  ```ts
  export interface TrackStation extends PathStation { normal: Point }   // the side items stand on: away from an arc's center; left of travel on a line
  export interface TrackNearest { f: number; dist: number }
  export type TrackShapeKind = 'line' | 'arc' | 'path';                  // 'path' is reserved for a shape over nearestOnPath; not built here
  export interface TrackShape { readonly kind: TrackShapeKind; readonly length: number; at(f: number): TrackStation; nearest(p: Point): TrackNearest }
  export function lineShape(from: Point, to: Point): TrackShape
  export interface ArcTrackSpec { center: Point; radius: number; start: number; end: number; direction?: 'cw' | 'ccw' }
  export function arcShape(spec: ArcTrackSpec): TrackShape
  ```

- [ ] **Step 1: Set up the worktree**

```bash
git worktree add -b feat/arc-controls .claude/worktrees/arc-controls main
```
Move the session there (`EnterWorktree`), then `npm ci`. Expected: install completes.

- [ ] **Step 2: Write the failing line tests** in `track/shape.test.ts`

```ts
const line = lineShape({ x: 10, y: 20 }, { x: 210, y: 20 });
test('a line maps a fraction to a point along it, with a unit tangent and its left as normal', () => {
  expect(line.length).toBe(200);
  expect(line.at(0.25)).toEqual({ point: { x: 60, y: 20 }, tangent: { x: 1, y: 0 }, normal: { x: 0, y: -1 } });
});
test('nearest projects onto the segment and measures the distance', () => {
  expect(line.nearest({ x: 110, y: 50 })).toEqual({ f: 0.5, dist: 30 });
});
test('nearest past an end answers that end', () => {
  expect(line.nearest({ x: -40, y: 20 })).toEqual({ f: 0, dist: 50 });
});
test('a line drawn right to left has its normal pointing down', () => {
  expect(lineShape({ x: 210, y: 20 }, { x: 10, y: 20 }).at(0).normal).toEqual({ x: 0, y: 1 });
});
test('a zero-length line answers its one point, heading right, never NaN', () => {
  const dot = lineShape({ x: 5, y: 5 }, { x: 5, y: 5 });
  expect(dot.at(0.5)).toEqual({ point: { x: 5, y: 5 }, tangent: { x: 1, y: 0 }, normal: { x: 0, y: -1 } });
  expect(dot.nearest({ x: 9, y: 8 })).toEqual({ f: 0, dist: 5 });
});
```

- [ ] **Step 3: Write the failing arc tests** in `track/arc.test.ts` (use `toBeCloseTo` per coordinate; helper `close(p, q)`)

```ts
const C = { x: 0, y: 0 };
test('a clockwise quarter from 12 to 3 o\'clock', () => {
  const a = arcShape({ center: C, radius: 100, start: 0, end: 90 });
  expect(a.length).toBeCloseTo(50 * Math.PI);
  close(a.at(0).point, { x: 0, y: -100 }); close(a.at(0).tangent, { x: 1, y: 0 }); close(a.at(0).normal, { x: 0, y: -1 });
  close(a.at(0.5).point, { x: 70.7107, y: -70.7107 });
  close(a.at(1).point, { x: 100, y: 0 }); close(a.at(1).tangent, { x: 0, y: 1 });
});
test('counterclockwise runs the other way round, its normal still outward', () => {
  const a = arcShape({ center: C, radius: 100, start: 0, end: 270, direction: 'ccw' });
  expect(a.length).toBeCloseTo(50 * Math.PI);
  close(a.at(0).tangent, { x: -1, y: 0 }); close(a.at(0).normal, { x: 0, y: -1 });
  close(a.at(1).point, { x: -100, y: 0 });
});
test('a sweep through 12 o\'clock wraps', () => {
  const a = arcShape({ center: C, radius: 100, start: 300, end: 60 });
  expect(a.length).toBeCloseTo((100 * 2 * Math.PI) / 3);
  close(a.at(0.5).point, { x: 0, y: -100 });
});
test('equal start and end is a whole circle', () => {
  expect(arcShape({ center: C, radius: 10, start: 45, end: 45 }).length).toBeCloseTo(20 * Math.PI);
});
const bottom = arcShape({ center: C, radius: 100, start: 240, end: 120, direction: 'ccw' });
test('nearest inside the sweep projects by angle', () => {
  const n = bottom.nearest({ x: 0, y: 150 });
  expect(n.f).toBeCloseTo(0.5); expect(n.dist).toBeCloseTo(50);
});
test('nearest past either end answers the nearer end, never the far one', () => {
  const at = (deg: number) => ({ x: 100 * Math.sin((deg * Math.PI) / 180), y: -100 * Math.cos((deg * Math.PI) / 180) });
  expect(bottom.nearest(at(250)).f).toBe(0);
  expect(bottom.nearest(at(110)).f).toBe(1);
  expect(bottom.nearest(at(30)).f).toBe(1);
  expect(bottom.nearest(at(330)).f).toBe(0);
});
test('the center answers as 12 o\'clock, never NaN', () => {
  expect(Number.isFinite(bottom.nearest(C).f)).toBe(true);
});
```

- [ ] **Step 4: Run both to verify they fail**

Run: `npx vitest run --project=weasel-ui packages/geom/src/track/shape.test.ts` and the same for `arc.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 5: Implement `lineShape` and `arcShape`**

`lineShape` uses `nearestOnLine` for `nearest` (`t` is `f`). `at` clamps `f` to 0..1. The arc's point at angle θ is `center + r·(sin θ, −cos θ)`. Its clockwise tangent is `(cos θ, sin θ)`, negated for `'ccw'`, and its normal is `(sin θ, −cos θ)`. The sweep is `(end − start) mod 360` taken in the arc's direction, with 0 read as 360. `nearest` takes the angle of `p` from the center, measures its offset from `start` in the arc's direction (mod 360), uses `offset / sweep` when the offset is inside the sweep, and otherwise picks the end at the smaller angular gap. `dist` is the Euclidean distance to `at(f).point`. Export both from `index.ts` with their types.

- [ ] **Step 6: Run both to verify they pass**, plus `npx vitest run --project=weasel-ui packages/geom/src/exports.test.ts`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/geom/src/track packages/geom/src/index.ts packages/geom/src/exports.test.ts
git commit -m "add line and arc track shapes to geom"
```

---

### Task 2: Reading runs and path data over a shape

**Files:**
- Create: `packages/geom/src/track/run.ts` (`trackRun`)
- Create: `packages/geom/src/track/pathData.ts` (`trackShapeD`)
- Modify: `packages/geom/src/index.ts`
- Test: `packages/geom/src/track/run.test.ts`, `packages/geom/src/track/pathData.test.ts`

**Interfaces:**
- Consumes: `TrackShape`, `TrackStation`, `TrackNearest`, `lineShape`, `arcShape` (Task 1).
- Produces:
  ```ts
  /** A station as a run places an item: `normal` is the item's up after any flip, `tangent` its reading direction,
   *  `angle` the CSS rotation in degrees that tips an upright item to it (0 = upright, clockwise positive, in (-180, 180]). */
  export interface TrackPlace extends TrackStation { angle: number }
  /** The stretch `from..to` of a shape in reading order. It is itself a TrackShape: `at(g)` and `nearest(p).f` are
   *  in reading order, g = 0 at the reading start. */
  export interface TrackRun extends TrackShape {
    readonly shape: TrackShape; readonly from: number; readonly to: number;
    readonly flipped: boolean; readonly reversed: boolean;
    at(g: number): TrackPlace;
  }
  export function trackRun(shape: TrackShape, from?: number, to?: number): TrackRun   // defaults 0, 1
  export function trackShapeD(shape: TrackShape, from?: number, to?: number): string  // SVG path data, coordinates to 4 places, no "-0"
  ```
- The flip rule, decided here once for every control: take the station at the run's midpoint `(from + to) / 2`. The run is **flipped** when its `normal.y > 1e-9`, which means the normal points down the screen. Flipped, up is `−normal`; otherwise up is `normal`. The reading direction is up rotated a quarter turn clockwise, `(−up.y, up.x)`. The run is **reversed** when that direction points against the midpoint's tangent (negative dot product). Because a run centered at 3 or 9 o'clock has a horizontal normal, it never flips: its items read top to bottom at 3 o'clock and bottom to top at 9.

- [ ] **Step 1: Write the failing run tests**

```ts
const C = { x: 0, y: 0 };
test('a left-to-right line is its own run', () => {
  const r = trackRun(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }));
  expect([r.flipped, r.reversed]).toEqual([false, false]);
  expect(r.at(0.5).angle).toBeCloseTo(0); expect(r.length).toBe(100);
});
test('a right-to-left line flips and reverses, so it still reads left to right, upright', () => {
  const r = trackRun(lineShape({ x: 100, y: 0 }, { x: 0, y: 0 }));
  expect([r.flipped, r.reversed]).toEqual([true, true]);
  close(r.at(0).point, { x: 0, y: 0 }); expect(r.at(0.5).angle).toBeCloseTo(0);
});
test('a run along the top reads left to right with each item tipped to the curve', () => {
  const r = trackRun(arcShape({ center: C, radius: 100, start: 300, end: 60 }));
  expect([r.flipped, r.reversed]).toEqual([false, false]);
  expect(r.at(0).point.x).toBeLessThan(0); expect(r.at(0).angle).toBeCloseTo(-60); expect(r.at(0.5).angle).toBeCloseTo(0);
});
test('a run along the bottom flips: upright, left to right, up toward the center', () => {
  const r = trackRun(arcShape({ center: C, radius: 100, start: 120, end: 240 }));
  expect([r.flipped, r.reversed]).toEqual([true, true]);
  const p = r.at(0);
  expect(p.point.x).toBeLessThan(0); expect(r.at(0.5).angle).toBeCloseTo(0);
  expect(p.normal.x * (C.x - p.point.x) + p.normal.y * (C.y - p.point.y)).toBeGreaterThan(0);
});
test('an arc\'s direction does not change where a run places things', () => {
  const cw = trackRun(arcShape({ center: C, radius: 100, start: 120, end: 240 }));
  const ccw = trackRun(arcShape({ center: C, radius: 100, start: 240, end: 120, direction: 'ccw' }));
  for (const g of [0, 0.3, 1]) close(ccw.at(g).point, cw.at(g).point);
});
test('a run centered at 3 o\'clock reads top to bottom and one at 9 bottom to top, neither flipped', () => {
  const east = trackRun(arcShape({ center: C, radius: 100, start: 30, end: 150 }));
  const west = trackRun(arcShape({ center: C, radius: 100, start: 210, end: 330 }));
  expect([east.flipped, west.flipped]).toEqual([false, false]);
  expect(east.at(0.5).angle).toBeCloseTo(90); expect(west.at(0.5).angle).toBeCloseTo(-90);
});
test('a sub-run measures its own stretch and clamps nearest to its ends', () => {
  const shape = arcShape({ center: C, radius: 100, start: 300, end: 60 });
  const r = trackRun(shape, 0.25, 0.75);
  expect(r.length).toBeCloseTo(shape.length / 2);
  expect(r.nearest(shape.at(0).point).f).toBe(0);
  expect(r.nearest(shape.at(1).point).f).toBe(1);
});
test('nearest answers in reading order', () => {
  const r = trackRun(arcShape({ center: C, radius: 100, start: 120, end: 240 }));
  expect(r.nearest({ x: -86.6025, y: 50 }).f).toBeCloseTo(0);
});
```

- [ ] **Step 2: Write the failing path-data tests**

```ts
test('a line is one segment', () => {
  expect(trackShapeD(lineShape({ x: 0, y: 12 }, { x: 200, y: 12 }))).toBe('M 0 12 L 200 12');
});
test('a clockwise quarter is one small arc, sweep flag 1', () => {
  expect(trackShapeD(arcShape({ center: { x: 0, y: 0 }, radius: 100, start: 0, end: 90 }))).toBe('M 0 -100 A 100 100 0 0 1 100 0');
});
test('over half a turn sets the large-arc flag, and counterclockwise clears the sweep flag', () => {
  expect(trackShapeD(arcShape({ center: { x: 0, y: 0 }, radius: 100, start: 0, end: 90, direction: 'ccw' }))).toBe('M 0 -100 A 100 100 0 1 0 100 0');
});
test('a stretch of an arc draws only that stretch', () => {
  expect(trackShapeD(arcShape({ center: { x: 0, y: 0 }, radius: 100, start: 0, end: 180 }), 0, 0.5)).toBe('M 0 -100 A 100 100 0 0 1 100 0');
});
test('a whole circle is two half arcs', () => {
  expect(trackShapeD(arcShape({ center: { x: 0, y: 0 }, radius: 10, start: 0, end: 0 }))).toBe('M 0 -10 A 10 10 0 0 1 0 10 A 10 10 0 0 1 0 -10');
});
```

- [ ] **Step 3: Run to verify they fail**, each file singly. Expected: FAIL, module not found.

- [ ] **Step 4: Implement `trackRun` and `trackShapeD`**

`trackRun` maps `g` to `f = reversed ? to − g·(to − from) : from + g·(to − from)` and reads `shape.at(f)`. It sets the place's `normal` to up and its `tangent` to the reading direction, and takes `angle` as `atan2(reading)` in degrees. `length` is `shape.length · |to − from|`. For `nearest(p)` it calls `shape.nearest(p)`, clamps `f` into the stretch, then maps it back to `g`. `kind` is `shape.kind`. `trackShapeD` writes `M … L …` for `kind === 'line'`. For an arc it writes `M … A r r 0 large sweep …`, splitting a whole circle in two. Any other kind becomes a 64-step polyline sampled through `at`. To read an arc's radius and direction, `arcShape` attaches a non-enumerable `arc` field typed `ArcTrackSpec`. Export both from `index.ts`.

- [ ] **Step 5: Run to verify both files pass.** Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/geom/src/track packages/geom/src/index.ts
git commit -m "add reading runs and SVG path data over a track shape"
```

---

### Task 3: The `Along` wrapper

**Files:**
- Create: `packages/ui/src/components/Along/Along.tsx`, `Along.module.css`, `alongContext.ts`, `arcInBox.ts`, `index.ts`
- Modify: `packages/ui/src/components/Slider/useBoxes.ts` (option `untransformed`)
- Modify: `packages/ui/src/index.ts` (add `export * from './components/Along';`)
- Test: `packages/ui/src/components/Along/Along.test.tsx`, `packages/ui/src/components/Along/arcInBox.test.ts`

**Interfaces:**
- Consumes: `arcShape`, `ArcTrackSpec`, `TrackShape`, `Point` from `@weasel-js/geom`; `useBoxes`, `Box` from `../Slider/useBoxes`.
- Produces:
  ```ts
  export interface AlongArc { start: number; end: number; direction?: 'cw' | 'ccw'; radius?: number; center?: Point; inset?: number }
  export type RunAlign = 'start' | 'center' | 'end';
  export interface AlongProps { arc?: AlongArc; shape?: TrackShape | ((box: Box) => TrackShape); align?: RunAlign; className?: string; children: ReactNode }
  export function Along(props: AlongProps): ReactElement
  export interface AlongCtx { shape: TrackShape; align: RunAlign }
  export function useTrackShape(): AlongCtx | null
  export function arcInBox(arc: AlongArc, box: Box): ArcTrackSpec
  // useBoxes(elements, count, opts?: { untransformed?: boolean }) — reads offsetWidth/offsetHeight instead of the client rect
  ```
- Decisions: the radius defaults to the box's inscribed circle, `min(w, h) / 2`, less `inset` (default 0, floored at 0). The center defaults to the box's center. An explicit `radius` or `center` wins. `Along` fills its containing block (`position: absolute; inset: 0`) and takes no pointer input (`pointer-events: none`). Shape coordinates are px in that box. `shape` wins over `arc`. With neither, the default is `{ start: 270, end: 90 }`, the top half. `align` defaults to `'center'`.

- [ ] **Step 1: Write the failing tests**

`arcInBox.test.ts`:
```ts
test('an arc is sized to the box\'s inscribed circle less its inset', () => {
  expect(arcInBox({ start: 240, end: 120, direction: 'ccw', inset: 12 }, { width: 200, height: 160 }))
    .toEqual({ center: { x: 100, y: 80 }, radius: 68, start: 240, end: 120, direction: 'ccw' });
});
test('an explicit radius and center win over the box', () => {
  expect(arcInBox({ start: 0, end: 90, radius: 40, center: { x: 5, y: 6 } }, { width: 200, height: 200 }))
    .toMatchObject({ center: { x: 5, y: 6 }, radius: 40 });
});
test('a box smaller than its inset gives radius 0, never negative', () => {
  expect(arcInBox({ start: 0, end: 90, inset: 30 }, { width: 40, height: 40 }).radius).toBe(0);
});
```
`Along.test.tsx` (stub `Element.prototype.getBoundingClientRect` to 200×200 in `beforeAll`, restore in `afterAll`, as `Slider.renderCtx.test.tsx` does):
```ts
test('Along hands its descendants an arc sized from its own box', () => {
  let seen: AlongCtx | null = null;
  const Probe = () => { seen = useTrackShape(); return null; };
  render(<Along arc={{ start: 300, end: 60 }}><Probe /></Along>);
  expect(seen!.shape.kind).toBe('arc');
  expect(seen!.shape.length).toBeCloseTo((100 * 2 * Math.PI) / 3);
  expect(seen!.align).toBe('center');
});
test('outside an Along there is no shape', () => { /* Probe renders bare; expect(seen).toBeNull() */ });
test('a 0×0 box places everything at the box\'s center, never NaN', () => {
  // stub returns 0×0 for this test; seen.shape.at(0.5).point is { x: 0, y: 0 } and finite
});
```

- [ ] **Step 2: Run each file to verify it fails.** Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `arcInBox`, `alongContext.ts` (`createContext<AlongCtx | null>(null)`, `useTrackShape`), and `Along`. `Along` measures its own box with `useBoxes`. The new `untransformed` option is not needed for the wrapper itself, but add it now because Task 5 uses it. `Along.module.css` holds `.along { position: absolute; inset: 0; pointer-events: none; }`. `index.ts` exports `Along`, `useTrackShape`, `arcInBox` and the types.

- [ ] **Step 4: Run each file to verify it passes.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Along packages/ui/src/components/Slider/useBoxes.ts packages/ui/src/index.ts
git commit -m "add an Along wrapper that hands an arc sized from its box to the controls inside it"
```

---

### Task 4: Slider measures through its geometry (no behavior change)

All of a straight slider's pointer math moves behind a `SliderGeometry` built on `lineShape` and `trackRun`, and `SliderBody` is split along its responsibilities. Nothing a straight slider does changes.

**Files:**
- Create: `packages/ui/src/components/Slider/sliderGeometry.ts` (types, `lineGeometry`)
- Create: `packages/ui/src/components/Slider/useSliderPointer.ts` (track press, thumb press, thumb context menu, moved out of `SliderBody.tsx:41-110`)
- Create: `packages/ui/src/components/Slider/thumbKeys.ts` (`onThumbKeyDown`, moved out of `SliderBody.tsx:112-138`)
- Create: `packages/ui/src/components/Slider/SliderMarks.tsx` (`SliderTicks`, `SliderStopLabels`, moved out of `SliderBody.tsx:151-178,195-210`)
- Modify: `packages/ui/src/components/Slider/SliderBody.tsx`, `useThumbDrags.ts` (takes `geometry` in place of `railRef`), `useSpan.ts` (`valueAt(f, length)`, the parameter renamed from `trackWidth`)
- Modify: `scripts/check-size.allow.json` (through `--update` only)
- Test: `packages/ui/src/components/Slider/sliderGeometry.test.ts`

**Interfaces:**
- Consumes: `lineShape`, `trackRun`, `Point` from `@weasel-js/geom`.
- Produces:
  ```ts
  /** Where a client point falls on a slider's value span. */
  export interface SliderMeasure { g: number; gRaw: number; dist: number; across: number; length: number; thickness: number }
  //   g: 0..1 along the value span in reading order; gRaw: the same, unclamped past the ends (a line extends straight;
  //   an arc extends by angle) — what shift-drag differences, so a straight slider's shift-drag is unchanged at the ends;
  //   across: distance off the span along its normal;
  //   length: the span's length in px (what STOP_SNAP_PX is divided by); thickness: the band's thickness in px
  export interface SliderGeometry {
    readonly curved: boolean;
    place(g: number): CSSProperties;                                        // line: { left: `${g * 100}%` }
    measure(clientX: number, clientY: number): SliderMeasure | null;          // null before mount
  }
  export function lineGeometry(rail: () => HTMLElement | null): SliderGeometry
  /** Band thicknesses off the centerline past which a drag drops a thumb: the old "out of the rail's box by more than its height". */
  export const DROP_OFF = 1.5;
  ```
- `lineGeometry.measure` reads the rail's `getBoundingClientRect()` on every call. Existing tests stub exactly that element through `stubRect`. It runs `trackRun(lineShape({x: left, y: top + h/2}, {x: left + width, y: top + h/2}))`, returns `length = width` and `thickness = h`, and takes `across` as `|(p − at(g).point) · at(g).normal|`.
- Every pointer path reads `measure` alone:
  - a track press: `valueAt(m.g, m.length)`;
  - a thumb drag: the same, and it drops the thumb when `m.across > DROP_OFF * m.thickness`;
  - a shift-drag: `m.gRaw − anchorG`, where `anchorG` is `gRaw` measured at the press. `beginShiftAllDrag(origin, down, anchorG: number)` replaces `anchorX`. On a line `gRaw` is `(clientX − left) / width` exactly, which is today's arithmetic.
- Every part reads `place(g)` for its position: thumbs, ticks, stop labels and readouts.

- [ ] **Step 1: Write the failing geometry test**

```ts
test('a line measures a client point against its rail', () => {
  const rail = document.createElement('div');
  stubRect(rail, { left: 0, width: 200, height: 24, top: 0, bottom: 24 });
  const geo = lineGeometry(() => rail);
  expect(geo.measure(50, 12)).toEqual({ g: 0.25, gRaw: 0.25, dist: 0, across: 0, length: 200, thickness: 24 });
  expect(geo.measure(50, 60)!.across).toBe(48);
  expect(geo.measure(260, 12)).toMatchObject({ g: 1, gRaw: 1.3 });
  expect(geo.place(0.5)).toEqual({ left: '50%' });
  expect(geo.curved).toBe(false);
});
test('an unmounted rail measures nothing', () => expect(lineGeometry(() => null).measure(0, 0)).toBeNull());
```

- [ ] **Step 2: Run it to verify it fails.** `npx vitest run --project=weasel-ui packages/ui/src/components/Slider/sliderGeometry.test.ts` → FAIL.

- [ ] **Step 3: Implement `lineGeometry`; route `useThumbDrags`, the track press and the shift-drag through it; split `SliderBody`** into the files above, so its render function drops under 120 lines and `useThumbDrags`' longest function stays at or under 140. Each extracted hook or function takes the values it reads (`geometry`, `scale`, `span`, the thumb list, the handlers) and not `SliderBody`'s whole scope.

- [ ] **Step 4: Run the new test and the drag-heavy existing files singly**: `sliderGeometry.test.ts`, `Slider.drag.test.tsx`, `Slider.trackClick.test.tsx`, `Slider.addRemove.test.tsx`, `Slider.stops.test.tsx`, `Slider.render.test.tsx`. Expected: all PASS unedited.

- [ ] **Step 5: Lower the size allowlist**: `npm run check:size -- --update`, then `npm run check:size`. Expected: PASS. The `SliderBody.tsx` entry is gone or lower, and the `useThumbDrags.ts` entry is ≤ 140.

- [ ] **Step 6: Commit and run the fleet**

```bash
git add packages/ui/src/components/Slider scripts/check-size.allow.json
git commit -m "measure a slider's pointers through a line geometry and split SliderBody by responsibility"
npm run test:fleet -- HEAD
```
Expected: the log shows `fleet-tree: N changed path(s) match <sha>`, and every Slider, DetentSlider, Jog, GradientEditor and `sliderSlop` test passes, the browser files included.

---

### Task 5: Slider on a curve

**Files:**
- Modify: `packages/ui/src/components/Slider/sliderGeometry.ts` (add `curvedGeometry`), `types.ts` (`SliderProps.shape`, `TrackCtx.shape`), `SliderBody.tsx`, `SliderMarks.tsx`, `Slider.module.css`
- Create: `packages/ui/src/components/Slider/useSliderGeometry.ts`, `SliderBand.tsx`
- Modify: `packages/ui/src/paintGradientTrack.tsx` (returns `null` off a line; TSDoc says it is line-only in this pass)
- Modify: `packages/ui/src/components/DetentSlider/DetentSlider.tsx`, `packages/ui/src/components/Jog/Jog.tsx` (forward a `shape?: TrackShape` prop to their `Slider`)
- Test: `packages/ui/src/components/Slider/Slider.along.test.tsx`, `packages/ui/src/paintGradientTrack.test.tsx` (add one case), `packages/ui/src/components/DetentSlider/DetentSlider.test.tsx` (add one case)

**Interfaces:**
- Consumes: `trackRun`, `trackShapeD`, `TrackShape`, `TrackRun` (Tasks 1–2); `useTrackShape` (Task 3); `SliderGeometry`, `lineGeometry`, `DROP_OFF` (Task 4).
- Produces:
  ```ts
  // types.ts
  SliderProps.shape?: TrackShape   // wins over an enclosing Along; in the coordinates of the slider's containing block
  TrackCtx.shape: TrackShape       // the value span as a shape in the painted layer's px, in reading order:
                                   // shape.at(valueToFraction(v)) is where a thumb at v sits, on a line or a curve
  // sliderGeometry.ts
  export function curvedGeometry(run: TrackRun, root: () => HTMLElement | null, band: () => SVGElement | null): SliderGeometry
  //   place(g) → { '--at-x': `${x}px`, '--at-y': `${y}px`, '--at-angle': `${angle}deg` }
  //   measure: client point minus root's rect left/top → run.nearest; thickness = band's computed stroke-width, else 24
  // useSliderGeometry.ts
  export function useSliderGeometry(args: { shape: TrackShape | undefined; thumbFit: 'inside' | 'overhang'; thumbLength: number;
    rail: () => HTMLElement | null; root: () => HTMLElement | null; band: () => SVGElement | null }): { geometry: SliderGeometry; run: TrackRun | null }
  ```
- Decisions:
  - **Which shape applies.** The `shape` prop, else the shape the enclosing `Along` provides, else none. A `line`-kind shape, given either way, means today's layout, and its coordinates are not read.
  - **The value span.** Under `'inside'` it is `trackRun(shape, i, 1 − i)` with `i = min(0.5, thumbLength / 2 / shape.length)`, so on an arc shorter than one thumb the span collapses to the arc's middle instead of inverting. Under `'overhang'` it is `trackRun(shape)`. `thumbLength` is the first thumb's untransformed width (`useBoxes(…, { untransformed: true })`), else 14.
  - **The root on a curve.** The root gets `className` `s.curved` and `data-shape={shape.kind}`. It fills its containing block (`position: absolute; inset: 0; pointer-events: none`).
  - **The band.** `SliderBand` replaces `.row` and `.track`. It is one `<svg>` with three paths, all drawn with `trackShapeD(shape)` over the whole shape:
    - `.bandSlop`: transparent, `stroke-width: calc(var(--rp-track-height, 24px) + 2 * var(--wzl-slider-track-slop))`, `pointer-events: stroke`. The track press binds here, so the middle of an arc's circle is not track.
    - `.bandEdge`: `stroke: var(--wzl-border)`, `stroke-width: calc(var(--rp-track-height, 24px) + 2px)`.
    - `.bandFace`: `stroke: var(--wzl-surface-sunken)`, `stroke-width: var(--rp-track-height, 24px)`.
    - All three have `fill: none`. A `renderTrack` painter draws in a `div.paintLayer` (`position: absolute; inset: 0; pointer-events: none`) over the band.
  - **Thumbs, ticks and stop labels** take `place(g)`. Under `.curved` the CSS sets `left: var(--at-x); top: var(--at-y); transform: translate(-50%, -50%) rotate(var(--at-angle))` and `pointer-events: auto` on thumbs. The thumb is `height: calc(var(--rp-track-height, 24px) + 4px)`, the tick 60% of the track height. A stop label adds `translateY(calc(var(--rp-track-height, 24px) / 2 + var(--wzl-space-xs) + 0.5lh))` after the rotate, which puts it on the run's lower side (outside the circle on a bottom arc). The end-label clamps (`[data-edge]`) do not apply on a curve.
  - **ARIA.** `aria-orientation` is omitted when `geometry.curved`.
  - **`readoutPlacement`.** `'inline-after'` is drawn as `'below-thumb'` on a curve (Task 6), since a curve has no row beside it. The TSDoc says so.
  - **`TrackCtx` on a line.** `shape = trackRun(lineShape({x: i, y: h/2}, {x: i + railW, y: h/2}))`, with `i = (trackW − railW) / 2`. Add the rail to the `useBoxes` list. `trackWidth` and `fractionToPosition` are unchanged. On a curve `trackWidth` is the run's length.

- [ ] **Step 1: Write the failing tests** in `Slider.along.test.tsx`

Stub `getBoundingClientRect` as `Slider.renderCtx.test.tsx` does: a `role="slider"` element is 10×20, everything else 200×200 at (0, 0). Stub `HTMLElement.prototype.offsetWidth` to 10 for thumbs. The fixture is `top = arcShape({ center: {x:100,y:100}, radius: 80, start: 300, end: 60 })`, and `run = trackRun(top)` for `thumbFit: 'overhang'`.
```ts
test('a thumb on an arc sits at the arc\'s point for its value, tipped', () => {
  // <Slider shape={top} thumbFit="overhang" min={0} max={100} thumbs={[{ value: 25 }]} onInput={noop} />
  const p = run.at(0.25);
  expect(thumb.style.getPropertyValue('--at-x')).toBe(`${p.point.x}px`);
  expect(thumb.style.getPropertyValue('--at-angle')).toBe(`${p.angle}deg`);
});
test('a press on the band picks the value at the nearest point along the arc', () => {
  const p = run.at(0.75).point; fireEvent.pointerDown(band, { clientX: p.x, clientY: p.y + 3, pointerId: 1 });
  expect(onInput).toHaveBeenLastCalledWith([{ value: 75 }]);
});
test('a thumb dragged along the arc follows the projected fraction', () => { /* drag to run.at(0.6) → value 60 */ });
test('shift-drag moves every thumb by the difference of the projected fractions', () => {
  // thumbs 20 and 40, allowShiftAll; shift-press at run.at(0.2), move to run.at(0.3) → [30, 50]
});
test('shift-drag past an end of the arc keeps moving by angle, as a line keeps moving past its end', () => {
  // thumbs 80 and 90; shift-press at run.at(0.9), move to the point 0.05 of the sweep past run.at(1) → both clamp at max, no dead travel before it
});
test('a stop attracts within STOP_SNAP_PX measured along the arc', () => {
  // stops [50]; press at run.at(0.5 + 6 / run.length) → 50; at run.at(0.5 + 12 / run.length) → not 50
});
test('dragging out from the arc by more than 1.5 band thicknesses removes the thumb', () => {
  // onRemoveThumb={() => true}; band stroke-width is the 24 fallback in jsdom; drag outward along normal by 37 → removed, by 35 → kept
});
test('a thumb on a curve has no aria-orientation; a straight one keeps horizontal', () => { /* both */ });
test('arrow, Page, Home and End step a thumb on a curve as on a line', () => {
  // value 50, step 1: ArrowRight → 51, PageUp → 60 from 50, Home → 0, End → 100
});
test('thumbFit inside starts the span half a thumb along the arc', () => {
  // thumbs [{ value: 0 }] with default thumbFit: --at-x equals trackRun(top, 5 / top.length, 1 - 5 / top.length).at(0).point.x
});
test('an arc shorter than a thumb collapses the span to its middle rather than inverting', () => {
  // short = arcShape({ center, radius: 2, start: 0, end: 90 }) (length ≈ 3.14 < 10): thumbs at 0 and 100 share one --at-x, short.at(0.5)'s
});
test('the track painter gets the value span as a shape', () => {
  // renderTrack={(ctx) => { seen = ctx; return null; }}: seen.shape.at(seen.valueToFraction(25)).point equals run.at(0.25).point
});
test('a Slider\'s shape prop wins over Along\'s', () => { /* <Along arc={bottom}><Slider shape={top} …/></Along> → placed on top */ });
test('a Slider inside Along follows its arc', () => { /* <Along arc={{ start: 300, end: 60, inset: 20 }}><Slider …/></Along> → root data-shape="arc" */ });
```
`paintGradientTrack.test.tsx`: `test('paints nothing on a curved shape', …)` calls the painter with a ctx whose `shape.kind` is `'arc'` and expects `null`.
`DetentSlider.test.tsx`: `test('a shape reaches its slider', …)`: with `shape={top}`, the thumb has no `aria-orientation`.

- [ ] **Step 2: Run each to verify it fails.** Expected: FAIL (no `shape` prop; `aria-orientation` present).

- [ ] **Step 3: Implement** `curvedGeometry`, `useSliderGeometry`, `SliderBand`, the curved branch in `SliderBody` and `SliderMarks`, the `.curved` rules in `Slider.module.css`, `TrackCtx.shape`, the `paintGradientTrack` guard, and the `shape` forwarding in `DetentSlider` and `Jog`.

- [ ] **Step 4: Run each test file singly**, plus `Slider.renderCtx.test.tsx` and `Slider.thumbFit.test.tsx`. Expected: PASS, existing files unedited.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Slider packages/ui/src/paintGradientTrack.tsx packages/ui/src/paintGradientTrack.test.tsx packages/ui/src/components/DetentSlider packages/ui/src/components/Jog
git commit -m "lay a Slider along a curved track shape, measured and placed through it"
```

---

### Task 6: Readouts along a curve

**Files:**
- Create: `packages/ui/src/components/Slider/staggerRows.ts`, `packages/ui/src/components/Slider/ReadoutsAlong.tsx`
- Modify: `packages/ui/src/components/Slider/ReadoutsBelow.tsx` (its `stagger` uses `staggerRows`), `SliderBody.tsx`, `Slider.module.css`
- Test: `packages/ui/src/components/Slider/staggerRows.test.ts`

**Interfaces:**
- Consumes: `SliderGeometry.place`, `TrackRun.length` (Tasks 4–5).
- Produces:
  ```ts
  /** The row each span takes: the first where it clears everything already there by `gap`. */
  export function staggerRows(spans: readonly { start: number; end: number }[], gap: number): number[]
  export function ReadoutsAlong(props: { readouts: readonly { g: number; content: ReactNode }[]; place: (g: number) => CSSProperties; length: number }): ReactElement
  ```
- `ReadoutsBelow` builds each span from the item's `left`/`right` and is otherwise unchanged. `ReadoutsAlong` builds each span as `g·length ± offsetWidth/2`. It writes the row with `style.setProperty('--row', …)`, and the CSS adds `translateY(calc(var(--rp-track-height, 24px) / 2 + var(--wzl-space-2) + (var(--row, 0) + 1) * 1lh))` after the rotate, so readouts sit below the stop labels' line.

- [ ] **Step 1: Write the failing test**

```ts
test('spans that clear each other share row 0', () => expect(staggerRows([{ start: 0, end: 10 }, { start: 20, end: 30 }], 4)).toEqual([0, 0]));
test('an overlapping span steps down to the first row it clears', () => {
  expect(staggerRows([{ start: 0, end: 10 }, { start: 8, end: 18 }, { start: 12, end: 22 }, { start: 40, end: 50 }], 4)).toEqual([0, 1, 2, 0]);
});
test('order is by start, not by input order', () => expect(staggerRows([{ start: 20, end: 30 }, { start: 0, end: 22 }], 4)).toEqual([1, 0]));
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement** `staggerRows`; switch `ReadoutsBelow` to it; add `ReadoutsAlong`; draw it from `SliderBody` on a curve for `'below-thumb'` and `'inline-after'`.

- [ ] **Step 4: Run** `staggerRows.test.ts` and `Slider.render.test.tsx` singly. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Slider
git commit -m "stagger a slider's readouts along a curve with the straight row's rule"
```

---

### Task 7: Slider on a curve, in a browser and as a story

**Files:**
- Create: `packages/ui/src/components/Slider/Slider.along.browser.test.tsx`
- Create: `packages/ui/src/components/Slider/Slider.stories.module.css` (`.lens`: a 240px positioned circle with a border)
- Modify: `packages/ui/src/components/Slider/Slider.stories.tsx` (story `ZoomAlongALensRim`)

**Interfaces:**
- Consumes: `Along`, `Slider` with `shape` (Tasks 3–6).
- Fixture: a 240×240 `position: relative` box. Inside it `<Along arc={{ start: 240, end: 120, direction: 'ccw', inset: 16 }}>` holds `<Slider min={2} max={16} stops={[2, 4, 8, 16].map((v) => ({ value: v, label: `${v}×` }))} spacing="even" snap="strict" thumbs={[{ value: 4 }]} />`. The circle center is `(120, 120)` in the box, radius 104.

- [ ] **Step 1: Write the browser tests**

```ts
test('every tick and the thumb sit on the arc', () => { /* each center's distance from the circle center is 104 ± 1 */ });
test('the minimum is on the left: values read left to right along the bottom rim', () => { /* tick centers' x ascend in DOM order */ });
test('stop labels are upright enough to read and hang below the track', () => {
  // each label's getComputedStyle(transform) angle atan2(b, a) lies within (-90°, 90°); its center is farther from the circle center than 104
});
test('a press in the empty middle of the circle reaches what is beneath, not the track', () => {
  // an underlay button fills the box; elementFromPoint(center) is the underlay
});
test('a press on the band moves the thumb there, and a drag along the rim lands on a stop', () => {
  // userEvent / PointerEvent at the 8× tick's center → aria-valuenow 8; drag to the 16× tick → 16
});
test('the thumb\'s slop takes a press just off its edge', () => { /* as sliderSlop.browser.test.tsx, measured along the thumb's own axes */ });
test('resizing the box moves the thumb onto the new rim', async () => {
  // box to 320×320 → expect.poll: thumb center distance from (160,160) is 144 ± 1
});
```

- [ ] **Step 2: Add the story** `ZoomAlongALensRim`: the fixture above, with `useState` for the thumb, and a TSDoc line saying it is the lens's zoom along its bottom rim.

- [ ] **Step 3: Commit, then verify on the fleet**

```bash
git add packages/ui/src/components/Slider
git commit -m "prove a Slider along a lens rim in a browser and show it as a story"
npm run test:fleet -- HEAD
```
Expected: the fleet-tree line matches the commit, and `Slider.along.browser.test.tsx` and every existing Slider browser test pass. Fix anything that fails, commit, and rerun.

- [ ] **Step 4: Screenshot the story to the wall**

Run `npm run dev:fleet -- forge`. Open `ZoomAlongALensRim` headless (chrome-devtools) at the printed IP and screenshot the lens box at device scale 3, then `transom post <png>`. Check by eye that the labels read upright left to right, the thumb is tipped on the rim, and nothing straight-slider-shaped is left over.

---

### Task 8: Bar along a curve: placement and the More menu

**Files:**
- Create: `packages/ui/src/components/Bar/barItems.ts` (move `Item`/`Drawn`, `walk`, divider filtering out of `BarLayout.tsx:139-200`)
- Create: `packages/ui/src/components/Bar/runPlaces.ts`, `BarAlong.tsx`, `BarAlong.module.css`, `useItemLengths.ts`
- Modify: `packages/ui/src/components/Bar/BarLayout.tsx` (`shape`, `align` props; branch to `BarAlong`), `Bar.tsx` (pass `shape`, `align` through), `index.ts`
- Test: `packages/ui/src/components/Bar/runPlaces.test.ts`, `packages/ui/src/components/Bar/Bar.along.test.tsx`

**Interfaces:**
- Consumes: `trackRun`, `trackShapeD`, `TrackShape` (Tasks 1–2); `useTrackShape`, `RunAlign` (Task 3); `fitting`, `BAR_ITEM`, `BAR_MORE`, `BAR_LEAD` from `useBarOverflow.ts`.
- Produces:
  ```ts
  export interface BarItem { key: string; divider?: boolean; path?: string; leaf?: boolean; content?: ReactNode }   // what barItems returns
  export function barItems(nodes: readonly BarNode[], opts: { popLeaves: boolean; cells: BarLayoutProps['cells']; row: BarLayoutProps['row'] }): BarItem[]
  export interface RunSpot { center: number; clipped: 'none' | 'part' | 'past' }
  /** Where each item's center falls along a run `room` px long, gaps measured along it. Past `room` with `offset`, items are laid from the start less `offset`. */
  export function runPlaces(lengths: readonly number[], gap: number, room: number, align: RunAlign, offset: number): RunSpot[]
  export function useItemLengths(root: RefObject<HTMLElement | null>, keys: readonly string[]): ReadonlyMap<string, number>  // offsetWidth per [data-bar-item]/[data-bar-more]/[data-bar-lead], via ResizeObserver
  BarProps.shape?: TrackShape; BarProps.align?: RunAlign; BarLayoutProps.shape?: TrackShape; BarLayoutProps.align?: RunAlign
  ```
- Decisions:
  - A bar is curved when its shape (the prop, else `useTrackShape()`) is not `line`. A straight bar's markup is unchanged.
  - A curved bar calls `barItems` with `popLeaves: true`, so every leaf but `action`/`actions` opens from a `BarPopover`, as on a vertical bar.
  - The run is `trackRun(shape)`: it flips, or not, by the midpoint of the stretch the bar is given.
  - The lead comes first in reading order. In `'menu'` mode, `kept = fitting(keys, lengths, moreLength, { size: run.length − (leadLength ? leadLength + gap : 0), gap })`, and the More button is the last item in reading order.
  - `gap` is the bar root's computed `column-gap` (0 in jsdom).
  - Each item gets `run.at(center / run.length)` written as `--at-x`, `--at-y`, `--at-angle`. `BarAlong.module.css` puts the root at `position: absolute; inset: 0; pointer-events: none`. Its items are `position: absolute; left: var(--at-x); top: var(--at-y); transform: translate(-50%, -50%) rotate(var(--at-angle)); pointer-events: auto`, and `[data-clipped='part']` gets `opacity: 0.4`.
  - The root keeps `role="toolbar"`, `aria-label` and `className`, and adds `data-shape={shape.kind}`.
  - `BarLayout`'s function must come out shorter than it went in.

- [ ] **Step 1: Write the failing pure tests** (`runPlaces.test.ts`)

```ts
test('a run shorter than its room sits centered', () => expect(runPlaces([20, 20], 10, 100, 'center', 0).map((s) => s.center)).toEqual([35, 65]));
test('align start and end push it to the reading start and end', () => {
  expect(runPlaces([20, 20], 10, 100, 'start', 0).map((s) => s.center)).toEqual([10, 40]);
  expect(runPlaces([20, 20], 10, 100, 'end', 0).map((s) => s.center)).toEqual([60, 90]);
});
test('a run longer than its room lays from the start less the offset, and marks what lies past the ends', () => {
  expect(runPlaces([40, 40, 40, 40], 0, 100, 'center', 50)).toEqual([
    { center: -30, clipped: 'past' }, { center: 10, clipped: 'part' }, { center: 50, clipped: 'none' }, { center: 90, clipped: 'part' },
  ]);
});
test('no items is no places', () => expect(runPlaces([], 4, 100, 'center', 0)).toEqual([]));
```

- [ ] **Step 2: Write the failing wiring tests** (`Bar.along.test.tsx`; stub `offsetWidth` to 40 and `getBoundingClientRect` to 200×200)

```ts
test('on a shape every leaf but an action opens from a button', () => {
  // schema: number "Width" + action "Undo"; <Bar shape={top} …>: a "Width" button (BarPopover) and an "Undo" button, no spinbutton
});
test('a lone item sits at the run\'s middle, tipped', () => { /* --at-x/--at-angle equal trackRun(top).at(0.5) */ });
test('a straight bar on a line shape keeps its flex line', () => { /* shape={lineShape(...)}: no data-shape, no --at-x */ });
test('menu mode keeps what fits along the arc and puts More last in reading order', () => {
  // quarter arc r=100 (length ≈ 157.08), six 40px items, gap 0 → fitting gives 2 kept; More's --at-x is the greatest
});
test('an arc too short for any item keeps the More button alone at the run\'s center, holding every item', () => {
  // arc r=10: zero items on the line; More's place is trackRun(shape).at(0.5)
});
test('a Bar inside Along follows its arc and its align', () => { /* <Along arc={…} align="start"> → first item at runPlaces(..., 'start', 0)[0] */ });
```

- [ ] **Step 3: Run each file to verify it fails.** Expected: FAIL.

- [ ] **Step 4: Implement** `barItems` (moved, unchanged behavior), `runPlaces`, `useItemLengths`, `BarAlong`, and the props and branch in `BarLayout`/`Bar`.

- [ ] **Step 5: Run the new files and the existing jsdom Bar files singly**: `runPlaces.test.ts`, `Bar.along.test.tsx`, `Bar.test.tsx`, `Bar.menu.test.tsx`, `barSurfaces.test.tsx`, `renderBarLeaf.test.tsx`. Expected: PASS, the existing ones unedited.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/Bar
git commit -m "place a Bar's items along a curved track shape, overflowing into More at the run's end"
```

---

### Task 9: Popovers and menus open away from the center

**Files:**
- Create: `packages/ui/src/components/Bar/barSide.ts`
- Modify: `packages/ui/src/components/Bar/BarAlong.tsx` (provides the side per item), `BarPopover.tsx`, `BarOverflow.tsx` (RAC `Popover placement`), `BarMenu.tsx`
- Modify: `packages/ui/src/components/ContextMenu/useMenuTrigger.tsx` (`show(entries, source, silent?, above?)`), `menuUnder.ts` (`above` passed through), `ContextMenu/MenuPanel.tsx` (passes `above` to placement), `ContextMenu/ContextMenuHost.tsx` (carries it)
- Modify: `packages/routing/src/menus/menuHost.ts` (`MenuOpenRequest.above?: boolean`, copied onto `OpenMenu` as `under` is)
- Modify: `packages/menu/src/placement.ts` (`placeMenuUnder(size, under, bounds, above = false)`: above tries the top first and flips below)
- Test: `packages/ui/src/components/Bar/barSide.test.ts`, `packages/menu/src/placement.test.ts` (add cases; create the file if absent)

**Interfaces:**
- Consumes: `TrackPlace`, `TrackRun.flipped` (Task 2); `BarAlong` (Task 8).
- Produces:
  ```ts
  export type BarSide = 'top' | 'bottom' | 'left' | 'right';
  /** The compass side nearest `outward`; a tie between axes goes to top/bottom. */
  export function sideOf(outward: Point): BarSide
  export const BarSideContext: Context<BarSide | undefined>   // undefined on a straight bar: placement as today
  ```
- The side is taken from the shape's outward normal, not the item's flipped up: `outward = run.flipped ? −place.normal : place.normal`. That is what keeps a popover off the center on a flipped bottom run.
  - RAC popovers take the side as `placement`.
  - `BarMenu` passes `above = side === 'top'` to `trigger.show`. The menu placement code only goes above or below, so `'left'` and `'right'` fall back to below.
  - A straight bar provides no side, and nothing it opens moves.

- [ ] **Step 1: Write the failing tests**

```ts
// barSide.test.ts
test.each([[{ x: 0, y: -1 }, 'top'], [{ x: 0, y: 1 }, 'bottom'], [{ x: 1, y: 0 }, 'right'], [{ x: -1, y: 0 }, 'left'], [{ x: -0.6, y: -0.8 }, 'top'], [{ x: 0.7071, y: 0.7071 }, 'bottom']] as const)(
  'outward %o opens %s', (v, side) => expect(sideOf(v)).toBe(side));
// placement.test.ts
test('a menu asked to open above goes above the button when it fits', () => {
  expect(placeMenuUnder({ w: 100, h: 50 }, { x: 10, y: 200, w: 40, h: 20 }, { x: 0, y: 0, w: 800, h: 600 }, true)).toEqual({ x: 10, y: 150 });
});
test('one asked above with no room there flips below', () => {
  expect(placeMenuUnder({ w: 100, h: 50 }, { x: 10, y: 20, w: 40, h: 20 }, { x: 0, y: 0, w: 800, h: 600 }, true)).toEqual({ x: 10, y: 40 });
});
test('below stays the default', () => {
  expect(placeMenuUnder({ w: 100, h: 50 }, { x: 10, y: 200, w: 40, h: 20 }, { x: 0, y: 0, w: 800, h: 600 })).toEqual({ x: 10, y: 220 });
});
```

- [ ] **Step 2: Run each to verify it fails** (`npx vitest run --project=weasel-ui packages/menu/src/placement.test.ts`, and the same for `barSide.test.ts`). Expected: FAIL.

- [ ] **Step 3: Implement** `sideOf`, `BarSideContext` (provided per item in `BarAlong`), placement in `BarPopover` and `BarOverflow`, `above` through `BarMenu` → `useMenuTrigger` → `menuUnder` → `OpenMenu` → `MenuPanel` → `placeMenuUnder`.

- [ ] **Step 4: Run each file singly**, plus `BarMenu.test.tsx` and `Bar.menu.test.tsx`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Bar packages/ui/src/components/ContextMenu packages/routing/src/menus packages/menu/src
git commit -m "open a curved bar's popovers and menus away from its center"
```

---

### Task 10: A curved bar scrolls along its run

**Files:**
- Create: `packages/ui/src/components/Bar/useRunScroll.ts`
- Modify: `packages/ui/src/components/Bar/BarAlong.tsx`, `BarAlong.module.css`
- Test: `packages/ui/src/components/Bar/useRunScroll.test.tsx`

**Interfaces:**
- Consumes: `runPlaces`, `RunSpot`, `useItemLengths` (Task 8); `trackShapeD`, `TrackRun` (Task 2); `openPointerSession` from `@weasel-js/core`.
- Produces:
  ```ts
  /** Px a press must travel along the run before it is a scroll rather than a press on an item. */
  export const SCROLL_SLOP = 4;
  export function useRunScroll(args: { root: RefObject<HTMLElement | null>; run: TrackRun; total: number; spots: () => readonly RunSpot[]; lengths: readonly number[] }):
    { offset: number; onPointerDownCapture: (e: ReactPointerEvent) => void; onFocusCapture: (e: ReactFocusEvent) => void }
  ```
- Only in `'scroll'` mode, and only when `total > run.length`:
  - **Offset** is clamped to `0..total − run.length`.
  - **Wheel and trackpad** move it by `deltaY || deltaX` (×16 when `deltaMode` is lines). The listener is a native `wheel` listener with `{ passive: false }`, so it can `preventDefault` when the offset moved.
  - **Drag.** A press on an item or on the band (`<path class="band">` along `trackShapeD(shape)`, transparent, `stroke-width: var(--wzl-tb-height)`, `pointer-events: stroke`) opens a pointer session. Once the run fraction has moved more than `SCROLL_SLOP` px, it scrolls by `−Δg · run.length`, and the click that ends it is swallowed with a one-shot capture `click` listener.
  - **Focus.** Focus reaching an item whose span lies past an end sets the offset so the whole item is inside, at the nearer end.
  - **Clipping.** `[data-clipped='past']` is `opacity: 0; pointer-events: none`. It stays focusable, so Tab reaches it and brings it into view.
  - **More past here.** An end with any item past it shows `<span data-more-past="start|end" aria-hidden>` holding `icon('chevron')`, placed at `run.at(0)` or `run.at(1)` and turned to point out along the run. Proof the glyph's direction at 10× before settling the rotation (repo icon rules).
  - **What it doesn't touch.** A run that fits, and `'menu'` mode, are untouched.

- [ ] **Step 1: Write the failing tests** (`renderHook` over a fixed `run` from `trackRun(lineShape({x:0,y:0},{x:100,y:0}))`, `total` 160)

```ts
test('a wheel moves the offset and holds it inside the run', () => { /* dispatch WheelEvent deltaY 30 → 30; then 100 → 60 */ });
test('a press that does not travel is a press, not a scroll', () => { /* down and up at the same point → offset 0, the click not swallowed */ });
test('a drag along the run past the slop scrolls it and swallows the click', () => { /* move −20px → offset 20; click listener sees no click */ });
test('focus on an item past the end scrolls it fully into view at that end', () => { /* last item spans 140..160 → offset 60 */ });
test('a run that fits never scrolls', () => { /* total 80 → wheel leaves offset 0 */ });
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.

- [ ] **Step 3: Implement** `useRunScroll` and wire it, the band, clipping and end markers into `BarAlong`.

- [ ] **Step 4: Run** `useRunScroll.test.tsx` and `Bar.along.test.tsx` singly. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Bar
git commit -m "scroll a curved bar along its run by wheel, drag, and focus"
```

---

### Task 11: Bar on a curve, in a browser and as a story

**Files:**
- Create: `packages/ui/src/components/Bar/Bar.along.browser.test.tsx`
- Modify: `packages/ui/src/components/Bar/Bar.stories.tsx` (story `ActionsAlongALensTop`), `Bar.stories.module.css` (`.lens`, as in Task 7)

**Interfaces:**
- Consumes: everything above.
- Fixture: a 240×240 positioned box holding two wrappers over the same box. `<Along arc={{ start: 300, end: 60, inset: 18 }}>` holds `<Bar label="Lens" schema={…six actions…} />`, and `<Along arc={{ start: 240, end: 120, direction: 'ccw', inset: 16 }}>` holds the zoom `Slider` from Task 7. An underlay `<button>Image</button>` fills the box.

- [ ] **Step 1: Write the browser tests**

```ts
test('each action\'s center lies on the top arc, left to right, the middle one upright', () => { /* r 102 ± 1; x ascending; middle rotation ≈ 0 */ });
test('on a bottom arc the run flips and still reads left to right, every item upright enough to read', () => { /* |angle| < 90° */ });
test('a press in the middle of the circle reaches the image, not either control', () => { /* elementFromPoint(center) is the underlay */ });
test('menu mode on a short arc opens the rest from More at the run\'s end, above the bar', async () => {
  // More's center x is the greatest; click → dialog "More" holds the remaining actions; dialog.bottom <= More.top
});
test('scroll mode: Tab reaches every action, scrolling each past the end into view', async () => {
  // a too-short arc: for each Tab, the focused action has data-clipped none and its rect lies on the arc
});
test('the wheel and a drag along the band scroll; a still press on an action fires it', async () => { /* … */ });
test('resizing the box moves the actions onto the new rim', async () => { /* box to 320 → expect.poll on radius */ });
```
A straight bar's layout is covered by the existing `Bar.overflow.browser.test.tsx`, which runs unedited in the same fleet run.

- [ ] **Step 2: Add the story** `ActionsAlongALensTop`, the fixture as a story, with a TSDoc line naming the two wrappers over one box.

- [ ] **Step 3: Commit, then verify on the fleet**

```bash
git add packages/ui/src/components/Bar
git commit -m "prove a Bar along a lens's top rim in a browser and show it beside the zoom slider"
npm run test:fleet -- HEAD
```
Expected: the fleet-tree line matches; `Bar.along.browser.test.tsx` and every existing Bar and Slider browser test pass.

- [ ] **Step 4: Screenshot the story to the wall**, the same way as Task 7 Step 4, and `transom post <png>`. Check that the top run reads left to right, the bottom slider's labels read upright, a More popover opens outward, and the ends' "more past here" chevrons point out along the run.

---

### Task 12: Docs, changeset, retire the design, merge

**Files:**
- Modify (TSDoc): `packages/ui/src/components/Slider/types.ts` (`shape`, `TrackCtx.shape`, `readoutPlacement` on a curve), `Slider.tsx`, `Bar/Bar.tsx` (`shape`, `align`, curved overflow), `Along/Along.tsx` (one paragraph: arc convention, sizing, pointer pass-through, two wrappers over one box), `paintGradientTrack.tsx` (line-only this pass), `RangeSlider/RangeSlider.tsx` and `InlineRange/InlineRange.tsx` (one sentence each: "Straight only; for a control along a curve, use `Slider` inside `Along`.")
- Modify: `docs/TODO.md`. Add one P3 entry saying the remaining rows follow on `BarAlong`'s placement: `ButtonBar`, `ToggleBar`, segmented controls, `SwatchStrip`, `Tabs`/`PageTabs`, `RadioGroup`. Add one P3 entry for a curved gradient painter, and one for a `path` track shape over `measurePath`.
- Create: `.changeset/arc-controls.md`
- Delete: `docs/superpowers/specs/2026-10-21-arc-controls-design.md`, `docs/superpowers/plans/2026-10-21-arc-controls.md`

- [ ] **Step 1: Write the TSDoc and TODO entries** above. Check that nothing in the design doc worth keeping is lost, since its status line says it is deleted once this lands.

- [ ] **Step 2: Write the changeset**

```md
---
"@weasel-js/geom": patch
"@weasel-js/ui": patch
"@weasel-js/menu": patch
"@weasel-js/routing": patch
---

Controls can run along a curve. `@weasel-js/geom` adds track shapes (`lineShape`, `arcShape`), reading runs over them
(`trackRun`) and their SVG path data (`trackShapeD`). `@weasel-js/ui` adds `Along`, which sizes an arc from its box
and hands it to the controls inside; `Slider`, `DetentSlider`, `Jog` and `Bar` follow it, or a `shape` prop.
`TrackCtx` gains a required `shape` field — the value span as a shape — so code that builds a `TrackCtx` itself no
longer typechecks until it supplies one. `paintGradientTrack` paints straight tracks only. A menu opened under a
button can ask to open above it (`placeMenuUnder`'s `above`, `MenuOpenRequest.above`).
```

- [ ] **Step 3: Delete the design doc and this plan; commit**

```bash
git rm docs/superpowers/specs/2026-10-21-arc-controls-design.md docs/superpowers/plans/2026-10-21-arc-controls.md
git add .changeset/arc-controls.md docs/TODO.md packages
git commit -m "document controls along a curve and retire their design"
```

- [ ] **Step 4: Run the branch's fleet checks**

```bash
npm run check:bumps
npm run test:fleet -- HEAD
npm run test:fleet:postbuild -- HEAD
```
Expected: `check:bumps` passes; both fleet logs show the fleet-tree line for this commit, and both pass. The gate typechecks, lints, and runs `check:size`, `check:undescribed`, `check:imports` and `check:react-free`. Postbuild runs the consumer smoke, tree-shake and manifests. Fix, commit, rerun until both are green.

- [ ] **Step 5: Merge to main and test it there**

Merge `feat/arc-controls` into `main` per CLAUDE.md "Worktrees and the fleet" (no `pnpm-lock.yaml`), then start `npm run test:fleet -- main` in the background. Leave the worktree (`ExitWorktree`), remove it, and delete the branch.
