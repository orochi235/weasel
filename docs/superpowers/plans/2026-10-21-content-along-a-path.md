# Content Along a Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: in flight on `feat/content-along-path` (2026-10-21).** Delete with the design doc when it merges.

**Goal:** one geom placement primitive that lays any sequence of items along any track shape — a new `'path'` shape
included — and Text Along Path built on it as a path effect, with ui's curved bars moved onto the same primitive.

**Architecture:** geom gains `pathShape` (the reserved `'path'` kind), a `side` override on `trackRun`, and
`placeAlongRun` (ui's `runPlaces` moved and grown). text gains per-cluster outlines. core's `EffectSource` gains a lazy
item list and a `textAlong` effect kind that lays those items with `placeAlongRun`; path effects gain a general
`hideSources` option. path-tools ships the action family; draw and ui pick it up.

**Tech Stack:** TypeScript, React, vitest (jsdom + browser projects), the weasel monorepo.

**Spec:** `docs/superpowers/specs/2026-10-21-content-along-a-path-design.md`

## Global Constraints

- Worktree `.claude/worktrees/content-along-path` on `feat/content-along-path`; every path below is relative to it.
  Never edit the main checkout. Never `git stash`.
- Local runs: single jsdom files only — `npx vitest run --project=<project> <file>` (`npm run check:test-projects`
  names a directory's project). Browser tests, typecheck and anything wider go to the fleet on a commit:
  `npm run test:fleet -- HEAD`; a run counts only if its log's `fleet-tree: N changed path(s) match <sha>` names your
  commit.
- Biome packages: `npx biome check --diagnostic-level=error <files>` from the package dir before committing.
- `npm run check:size`: no source file over 400 lines, no function over 120.
- Every changeset is `patch`. Never write a `bump-approved` marker.
- A shipped package's source imports siblings by package name, never `export *` from another package in a barrel.
- Comments only where a reader would be harmed without them, 1–2 lines. US English.
- Commit subjects imperative, present tense; messages end `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Rulings (planner, 2026-10-21)

These settle what the design left to the builder; implementers do not reopen them.

| Question | Ruling |
|---|---|
| Primitive's name and home | `placeAlongRun` in `packages/geom/src/track/place.ts`, beside `run.ts`, with `runPlaces`/`runLength`/`RunSpot`/`RunAlign` moved there. ui's `Bar/index.ts` and `Along/index.ts` re-export `runPlaces`, `RunSpot`, `RunAlign` from geom by name, so the public ui paths keep working. |
| Where `side` lives | An options argument on `trackRun` — the run is where the flip is decided — so `placeAlongRun` takes it through its run. Default `'auto'`; `BarAlong` passes nothing. |
| Where `'auto'` is judged | At `options.about` (a shape fraction), default the run's middle. The text effect passes the middle of where its text lies, so turning the text over keeps it in place. |
| `'path'` shape's `nearest` | `PathMeasure.nearest` (flattened, tolerance 0.5), so `at` and `nearest` share one parameterization; `nearestOnPath` answers in curve parameter, not length. |
| `start` | A fraction 0..1 of the path's length, so it survives an edit that changes the path's length. Default 0. |
| How `EffectSource` carries items | An optional thunk `items?: () => readonly EffectItem[]`, called only by effects that lay items; shape-only effects never pay for it. |
| Glyph outlines while fonts load | The item thunk returns `[]` and marks the derivation font-dependent; derived-path memos record `glyphGeneration()` and re-derive when it changes. |
| Clipping at an open path's ends | SVG `textPath`'s rule: an item whose center falls outside `0..length` is not drawn. On a closed path, an item whose center lies a full length or more past the first item's start is not drawn. |
| Hiding sources | The scene's own `hidden` flag, set in the same batch as the insert; the effect records `hideSources: true`. Releasing unhides; deleting or expanding an effect with `hideSources` removes its hidden sources with it, one undo step. |
| Retargeting the path | `setEffectPathAction` for the along kinds (`bendAlong`, `repeatAlong`, `textAlong`), replacing source 1 and moving the hidden flag from the old path to the new one where `hideSources`. `setBlendSpine` stays as it is. |
| Live edit of a hidden text source | `useTextEdit` gains `onDraft`; `useSceneTextEdit` writes each draft through to the scene when something depends on the node, and a cancel restores the data it started from. In draw the text-edit mode's journal makes the whole edit one undo entry. |
| Repeat Along onto the primitive | Follows; filed in `docs/TODO.md`. Its count/spacing semantics are not item lengths, and moving it changes saved documents' output. |

## Review Focus

- **Deleting or expanding a text-along node** — a reasonable user expects its hidden text and path not to linger
  invisibly in the document. Pinned in Task 9.
- **A saved document opened before its fonts' outlines have loaded** — the curved text must appear once they land,
  not stay empty until the next edit. Pinned in Task 6.
- **Text that is empty or only spaces, and a path of one point or zero length** — the effect paints nothing, its pose
  falls back, nothing is `NaN`. Pinned in Tasks 1 and 7.
- **A compound path (several subpaths)** — the text runs on across subpaths in order, as `measurePath` measures them,
  with no `NaN` stations. Pinned in Task 1.
- **A rotated or scaled text source** — rotation and skew are ignored, scale grows the glyphs. Pinned in Task 6.

---

### Task 1: The `'path'` track shape

**Files:**
- Create: `packages/geom/src/track/path.ts`, `packages/geom/src/track/path.test.ts`
- Modify: `packages/geom/src/track/shape.ts` (add `closed`), `arc.ts`, `ellipse.ts` (set `closed`),
  `packages/geom/src/track/pathData.ts` (draw a whole path shape as its own path data), `packages/geom/src/index.ts`

**Interfaces:**
- Produces: `TrackShape.closed: boolean` — true for a whole-circle arc, a whole ellipse, and a path shape over a single
  closed contour; false otherwise (line always false).
- Produces: `pathShape(path: Path, options?: { flattenTolerance?: number }): PathTrackShape | null` — `null` for a path
  with no points. `type PathTrackShape = TrackShape & { readonly path: Path }` (non-enumerable, as `arc`/`ellipse` are).
  `kind: 'path'`; `at(f)` = `measure.at(clamp(f)·length, true)` (smooth tangents) with `normal` the left of travel
  `{ x: t.y, y: -t.x }`, as `lineShape`'s; `nearest(p)` = `measure.nearest(p).s / length`; with `{ open: true }` on a
  closed shape, `f` unwrapped to whichever of `f-1, f, f+1` is nearest `about` (default 0.5); open on an open shape
  clamps. A zero-length shape answers `f = 0` and finite stations.

- [ ] **Step 1: Write the failing tests** in `path.test.ts`:
  - `a straight path is the line track`: `pathShape(pathFromD('M0 0 L100 0'))` — `length` 100, `at(0.25).point` (25,0),
    `tangent` (1,0), `normal` (0,-1), `closed` false, `nearest({x:30,y:40})` → `{ f: 0.3, dist: 40 }`.
  - `a closed contour knows it is closed and unwraps nearest about 'about'`: a 100×100 square `M0 0 H100 V100 H0 Z` —
    `closed` true, `length` 400; `nearest({x:-1,y:10}, { open: true, about: 0.05 }).f` ≈ `-0.025`; without `open` ≈ 0.975.
  - `a circle path's normal points outward when drawn clockwise on screen`: from `ellipsePath`/`pathFromD` of a circle
    drawn clockwise in y-down — `at(f).normal` dotted with `(point − center)` > 0 at f ∈ {0.1, 0.4, 0.8}.
  - `a compound path runs on across its subpaths`: `M0 0 L10 0 M20 0 L30 0` — `length` 20, `closed` false, every
    `at(i/20)` finite.
  - `no points is null; one point is a zero-length shape that answers finitely`: `pathShape(pathFromD(''))` is `null`;
    `pathShape(pathFromD('M5 5'))` → `length` 0, `at(0.5)` finite, `nearest(...).f` 0.
  - `trackShapeD of a whole path shape is the path's own data` (`pathToD`), and a stretch of it is the 64-step polyline.
  - Extend `arc.test.ts`/`ellipse.test.ts`/`shape.test.ts`: `closed` true for equal start/end, false otherwise; line false.
- [ ] **Step 2:** Run `npx vitest run --project=core packages/geom/src/track/path.test.ts` (check the project with
  `npm run check:test-projects` first). Expected: FAIL, `pathShape` not exported.
- [ ] **Step 3:** Implement `pathShape` over `measurePath`; add `closed` to the three existing shapes; export
  `pathShape`, `PathTrackShape` from `packages/geom/src/index.ts`; update `TrackShapeKind`'s doc ('path' no longer
  reserved).
- [ ] **Step 4:** Run the four track test files. Expected: PASS.
- [ ] **Step 5:** Commit: `add a path track shape to geom, over measurePath, that knows whether it is closed`.

### Task 2: `trackRun` takes a side

**Files:**
- Modify: `packages/geom/src/track/run.ts`, `packages/geom/src/track/run.test.ts`, `packages/geom/src/index.ts`

**Interfaces:**
- Produces: `type TrackSide = 'auto' | 'path' | 'flipped'`;
  `trackRun(shape, from = 0, to = 1, options?: { side?: TrackSide; about?: number }): TrackRun`. `'auto'` is today's
  rule judged at shape fraction `about` (default `(from + to) / 2`); `'path'` forces `flipped = false`; `'flipped'`
  forces `flipped = true`. `reversed` follows from the flip exactly as now. `TrackRun` gains `readonly closed: boolean`
  = `shape.closed && |to − from| === 1`.

- [ ] **Step 1: Write the failing tests** in `run.test.ts`:
  - `side 'path' keeps a downward-facing line in the path's own direction`: `lineShape((100,0),(0,0))` (normal points
    down) — default run `flipped` true; with `{ side: 'path' }` `flipped` false, `reversed` false, `at(0).point` (100,0).
  - `side 'flipped' turns an upright run over`: `lineShape((0,0),(100,0))` with `{ side: 'flipped' }` — `flipped` and
    `reversed` true, `at(0).point` (100,0), `at(0.5).angle` 180.
  - `auto judged at 'about'`: an S-curve `pathShape` (`M0 50 C 50 -50 50 150 100 50`) — `flipped` at `about: 0.25`
    differs from `about: 0.75`.
  - `a whole run of a closed shape is closed`: whole-circle `arcShape` → `closed` true; `trackRun(circle, 0, 0.5)` false.
- [ ] **Step 2:** Run `run.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement; export `TrackSide`.
- [ ] **Step 4:** Run `run.test.ts`, `arc.test.ts`, `ellipse.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `let trackRun keep or turn over a run's side, judged where the caller says`.

### Task 3: The placement primitive in geom

**Files:**
- Create: `packages/geom/src/track/place.ts`, `packages/geom/src/track/place.test.ts`
- Modify: `packages/geom/src/index.ts`

**Interfaces:**
- Consumes: `TrackRun` (Task 2).
- Produces, all exported from `@weasel-js/geom`:
  - `type RunAlign = 'start' | 'center' | 'end'`; `interface RunSpot { center: number; clipped: 'none' | 'part' | 'past' }`.
  - `runLength(lengths: readonly number[], gap: number): number` — moved verbatim from ui.
  - `runPlaces(lengths, gap, room, align, offset, at?: number): RunSpot[]` — moved from ui unchanged when `at` is
    undefined. With `at`: the sequence's align point (its start, middle or end) sits at distance `at − offset` whether
    or not it fits, and `clipped` is always measured against `0..room`.
  - `runStationAt(run: TrackRun, distance: number, shift = 0): TrackPlace` — the place `distance` along the run; past
    either end it carries straight on along that end's reading tangent, tipped as at the end (what `placeOnRun` does
    today); the point then moves `shift` along the place's `normal`.
  - `interface PlaceAlongRunOptions { gap?: number; align?: RunAlign; offset?: number; at?: number; shift?: number;
    wrap?: boolean; past?: 'extend' | 'hold' }` (defaults 0, `'center'`, 0, undefined, 0, false, `'extend'`).
  - `interface RunPlace extends RunSpot, TrackPlace {}`.
  - `placeAlongRun(run: TrackRun, lengths: readonly number[], options?: PlaceAlongRunOptions): RunPlace[]` —
    `runPlaces(lengths, gap, run.length, align, offset, at)` then `runStationAt` at each center. `past: 'hold'` places a
    `'past'` item at the nearer end instead of beyond it (`BarAlong`'s rule). `wrap` (meaningful on a closed run): each
    center is taken modulo `run.length` before the lookup, and `clipped` is measured against
    `first item's start .. first item's start + run.length` instead of `0..room` — `'past'` once an item's start is a
    full length on, `'part'` while it straddles that point.

- [ ] **Step 1: Write the failing tests** in `place.test.ts`. Move `packages/ui/src/components/Bar/runPlaces.test.ts`'s
  cases here unchanged (import from `./place`), and add:
  - `'at' anchors the sequence whether or not it fits`: `runPlaces([40,40], 0, 100, 'center', 0, 30)` centers `[10, 50]`,
    clipped `['part', 'none']`; `runPlaces([40,40], 0, 100, 'start', 0, 0)` centers `[20, 60]`.
  - `placeAlongRun on a line puts each item's center on the line`: `trackRun(lineShape((0,0),(100,0)))`, lengths
    `[20, 20]`, `{ align: 'start', at: 0 }` → points (10,0), (30,0), `angle` 0.
  - `shift moves items off the run along its up`: same run, `{ shift: 5 }` → every `point.y` = −5.
  - `an item past the end carries on straight`: lengths `[40,40,40]`, `{ align: 'start', at: 0 }` on a 100 line →
    third center 100, point (100,0) with `clipped: 'part'`; with lengths `[60,60]` second point (90,0), and with
    `past: 'hold'` and a `'past'` item, the point is the run's end.
  - `on an arc the place tips to the tangent`: a top arc `arcShape({center:(0,0), radius:100, start:270, end:90})`,
    one item at `at: run.length / 2` → point (0,−100), angle 0.
  - `wrap carries items round a closed run`: whole-circle arc of length L; lengths `[L/4, L/4]`,
    `{ align: 'start', at: 0.9·L, wrap: true }` → second item's place equals `run.at(((0.9·L + 3L/8) mod L) / L).point`,
    `clipped` `'none'`; lengths `[L/2, L/2, L/2]` with the same → third item `clipped: 'past'`.
- [ ] **Step 2:** Run `place.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `place.ts`; export everything above from `packages/geom/src/index.ts`.
- [ ] **Step 4:** Run `place.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `add placeAlongRun to geom: item lengths laid as places along any track run`.

### Task 4: ui lays its rows with the geom primitive

**Files:**
- Delete: `packages/ui/src/components/Bar/runPlaces.ts`, `packages/ui/src/components/Bar/runPlaces.test.ts`
- Modify: `packages/ui/src/components/Bar/BarAlong.tsx`, `Bar/useRunScroll.ts`, `Bar/barItems.tsx`, `Bar/index.ts`,
  `Along/alongContext.ts`, `Along/index.ts`, `Along/placeOnRun.ts`, and every test importing `./runPlaces`
  (`Bar/useRunScroll.test.tsx`, `Bar/Bar.along.test.tsx`, `Bar/lab/BarArcView.browser.test.tsx`)

**Interfaces:**
- Consumes: Task 3's exports.
- Produces: no new ui API. `Bar/index.ts` re-exports `runPlaces`, `type RunSpot` from `@weasel-js/geom` by name;
  `Along/alongContext.ts` takes `RunAlign` from geom and `Along/index.ts` keeps exporting it.

- [ ] **Step 1:** `BarAlong` computes its spots with `placeAlongRun(run, orderLengths, { gap, align, offset, past: 'hold' })`
  (keeping `alongSpots`'s menu-mode offset rule) and styles each item from its `RunPlace` through `placeOnRun`;
  `spotG` goes. `placeOnRun(run, g, turn)` keeps its signature and becomes `runStationAt(run, g · run.length)` plus
  the CSS properties, so the Slider and `MorePast` callers are unchanged.
- [ ] **Step 2:** Run each touched jsdom test file: `npx vitest run --project=weasel-ui <file>` for
  `Bar.along.test.tsx`, `useRunScroll.test.tsx`, `Slider/Slider.along.test.tsx`, `Along/Along.test.tsx`. Expected:
  PASS with no assertion changed beyond imports.
- [ ] **Step 3:** `npx biome check --diagnostic-level=error` on the touched files from `packages/ui`.
- [ ] **Step 4:** Commit: `lay ui's curved bars with geom's placeAlongRun, retiring ui's runPlaces`. Then
  `npm run test:fleet -- HEAD` and confirm `BarArcView.browser.test.tsx` and `ClockSweepView.browser.test.tsx` pass.

### Task 5: Per-cluster outlines in text

**Files:**
- Modify: `packages/text/src/layout/layoutRuns.ts` (`PlacedGlyph.cell`), `packages/text/src/layout/layoutLines.ts`,
  `packages/text/src/textToPath.ts`, `packages/text/src/index.ts`
- Create: `packages/text/src/textClusters.ts`, `packages/text/src/textClusters.test.ts`

**Interfaces:**
- Produces: `PlacedGlyph.cell: number` — the index in its line's `cells` of the code point it draws.
- Produces:
  ```ts
  export interface TextCluster {
    /** Its slot's leading edge, from the line's left, in visual order. */
    x: number;
    /** The slot's width: its cells' advances, kerning and tracking included. */
    advance: number;
    /** Outlines with the slot's left edge at x = 0 and the baseline at y = 0, y down, one per paint; empty for a
     *  space or a color glyph. */
    paths: TextPaintPath[];
    /** Height of the x-height's middle above the baseline. */
    middle: number;
  }
  export function textClusters(data: TextOutlineSource, opts?: TextToPathOptions): TextCluster[];
  ```
  First laid line only, clusters in visual order, laid at the node's box origin (no pose frame). Throws
  `TextOutlinesError` as `textToPath` does, except that a color glyph keeps its advance with empty `paths`.
  `middle` = `xHeight · fontSize / 2` from the cluster's first glyph's resolved face (`faceMetricsOf`), `0.25 · fontSize`
  where the face has none. No decoration rules.

- [ ] **Step 1: Write the failing tests** in `textClusters.test.ts`, using the outline fixture face the existing
  `textToPath.test.ts` registers:
  - `one cluster per grapheme, advances summing to the line`: `'AVA'` → 3 clusters, `x` ascending, `x[i+1] === x[i] +
    advance[i]`, sum of advances equals the laid line's width; kerned `AV` advance differs from unkerned `A`'s.
  - `a combining mark stays with its base`: `'éx'` → 2 clusters.
  - `a space is a cluster with no paths`.
  - `glyphs sit on the baseline at the slot's left`: every path's bounds lie within `[−1, advance + 1]` in x and the
    `'x'` glyph's bottom is ≈ 0.
  - `only the first line`: `'ab\ncd'` → 2 clusters.
  - `right-to-left text comes in visual order`: with the bidi engine the existing `bidiIntegration.test.ts` installs,
    a Hebrew string's clusters' `x` ascend and the first cluster is the logically last.
  - `a color glyph keeps its slot and paints nothing`: text with an emoji, using the fixture `textToPath.test.ts`
    uses for `'color-glyph'` → cluster present, `paths` empty, no throw.
  - `textToPath is unchanged`: existing `textToPath.test.ts` passes untouched.
- [ ] **Step 2:** Run `npx vitest run --project=weasel-ui packages/text/src/textClusters.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Add `cell` where `layoutLines.ts` pushes glyphs (it walks `order.visual` in step with `cells[pos]`).
  Pull the per-glyph outline (the `emGlyph` + `emboldenGlyph` + shear matrix block in `walkOutlines`) into one
  function both `walkOutlines` and `textClusters` call. Group glyphs into clusters by walking `cells` in logical
  order and closing a cluster at each `clusterEnd`.
- [ ] **Step 4:** Run `textClusters.test.ts`, `textToPath.test.ts`, `textToPath.syntheticBold.test.ts`,
  `layoutLines.bidiOrder.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `add textClusters: a text line's grapheme clusters as outlines, each with its advance`.

### Task 6: Effect sources carry items; derived paths follow font loads

**Files:**
- Modify: `packages/core/src/core/scene/pathEffects/source.ts`, `packages/core/src/features/pathEffects/readSource.ts`,
  `packages/core/src/core/scene/pathEffects/derive.ts`, `packages/core/src/core/scene/derivedPath.ts`,
  `packages/core/src/core/scene/pathEffects/index.ts`, `packages/core/src/barrel/paths.ts`
- Create: `packages/core/src/core/scene/fontReads.ts`, `packages/core/src/features/pathEffects/textItems.ts`,
  `packages/core/src/features/pathEffects/textItems.test.ts`

**Interfaces:**
- Produces:
  ```ts
  /** One rigid piece an effect lays along a path, in its own frame: x from 0 at its leading edge to `length`, y down,
   *  its anchor line (a glyph's baseline) at y = 0. */
  export interface EffectItem { length: number; middle: number; parts: readonly DerivedPart[] }
  // EffectSource gains:
  items?: () => readonly EffectItem[];
  ```
- Produces: `fontReads.ts` — `noteFontRead(): void` and `withFontReads<T>(fn: () => T): { value: T; fonts: boolean }`.
  `resolveDerivedPath`'s memo record and `createPathEffectDerivations`' `Derived` record `glyphGeneration()` when the
  derivation noted a font read, and a hit whose recorded generation differs re-derives.
- Produces: `textEffectItems(data: TextOutlineSource, pose: PathInWorldPose): readonly EffectItem[]` in `textItems.ts` —
  `textClusters(data)` (scale 1, as `textToPath` resolves `{ px }`), each cluster's paths scaled by the pose's scale
  factor `sqrt(|det|)` of `poseFrameOf(pose)`'s linear part (1 with no frame) — rotation and skew dropped — and
  `noteFontRead()` called. `TextOutlinesError` → `[]`, after starting `loadTextOutlines`.
- `readEffectSource` attaches `items: () => textEffectItems(data, dep.pose)` when `isTextData(dep.node.data)`.

- [ ] **Step 1: Write the failing tests** in `textItems.test.ts` (fixture face as in Task 5):
  - `a text node's items are its clusters`: `textEffectItems({ text: 'Hi' }, pose)` → 2 items, lengths = advances.
  - `rotation is ignored and scale grows the glyphs`: a pose with `rotation: 30` gives the same items as without; a
    pose whose `transform` scales by 2 doubles every `length` and part bound.
  - `empty and space-only text has no ink`: `''` → `[]`; `'  '` → items with no parts.
  - `outlines still loading answer no items, and the derivation re-runs once they land`: register a face whose load
    is held by a deferred promise; build a scene with `withPathEffectsRegistry` holding a `textAlong` node (Task 7
    supplies the kind — write this case in Task 7's test file if Task 7 has not landed; here assert only
    `textEffectItems` returns `[]` and that `withFontReads(() => textEffectItems(...)).fonts` is true).
- [ ] **Step 2:** Run with `npx vitest run --project=core packages/core/src/features/pathEffects/textItems.test.ts`.
  Expected: FAIL.
- [ ] **Step 3:** Implement. `npm run check:imports` must pass (core already depends on `@weasel-js/text`; confirm
  `@weasel-js/font` is declared wherever `glyphGeneration` is imported).
- [ ] **Step 4:** Run `textItems.test.ts`, `features/pathEffects/pathEffects.frame.test.ts`,
  `pathEffects.override.test.ts`, and `core/scene/derivedPath*.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `let a path effect source carry items, with a text node's clusters as its items`.

### Task 7: The `textAlong` effect kind

**Files:**
- Create: `packages/core/src/core/scene/pathEffects/textAlong.ts`, `.../pathEffects/textAlong.test.ts`
- Modify: `packages/core/src/core/scene/pathEffects/effects.ts`, `.../pathEffects/index.ts`, `packages/core/src/barrel/paths.ts`

**Interfaces:**
- Consumes: `pathShape`, `trackRun` + `TrackSide`, `placeAlongRun`, `RunAlign` (Tasks 1–3); `EffectItem` (Task 6).
- Produces:
  ```ts
  /** Options every path effect may take. */
  export interface PathEffectOptions { /** Its sources are hidden while it shows them. */ hideSources?: boolean }
  /** Text (or any shape) laid along a path, item by item. Its sources are `[text, path]`. */
  export interface TextAlongEffect extends PathEffectOptions {
    kind: 'textAlong';
    align?: RunAlign;            // which part of the text sits at `start`; default 'start'
    start?: number;              // fraction 0..1 of the path's length; default 0
    shift?: number;              // world units the anchor line sits off the path, toward the glyphs' up; default 0
    anchor?: 'baseline' | 'center'; // 'center' sits glyphs on their x-height middle; default 'baseline'
    overflow?: 'clip' | 'fit';   // 'fit' squeezes the gap between items until the text fits; default 'clip'
    side?: TrackSide;            // default 'auto'
  }
  export function textAlongParts(effect: TextAlongEffect, items: readonly EffectItem[], path: Path): DerivedPart[];
  ```
  `BlendEffect`, `BendAlongEffect`, `RepeatAlongEffect` also extend `PathEffectOptions`; `PathEffect` gains
  `TextAlongEffect`; `effectParts` routes `'textAlong'` to `textAlongParts(effect, a.items?.() ?? [wholeItem(a)], b.world)`,
  where `wholeItem` is the source's world outline as one item (bounds' left at x = 0, vertical middle at y = 0,
  `middle` 0, paint `a.fill`/`a.stroke`).
- Algorithm (`textAlongParts`): `shape = pathShape(path)` (none → `[]`); `L = shape.length`; `total = runLength`; `k` = 0,
  ½, 1 for start/center/end; the text's middle in path terms `c = start·L + (½ − k)·total`; `run = trackRun(shape, 0, 1,
  { side, about: wrap(c / L) })`; its middle in run terms `m = run.reversed ? L − c : c`; `gap` = 0, or for `'fit'` when
  the text is longer than its room, `(room − total) / (n − 1)` where room is `L` on a closed path and on an open one
  `L − start·L`, `start·L`, or `2·min(start·L, L − start·L)` for start/end/center; then `placeAlongRun(run, lengths,
  { gap, align: 'center', at: m, shift, wrap: shape.closed })`. Each kept item's parts go through the affine
  `translate(place.point) · rotate(place.angle) · translate(−length/2, anchor === 'center' ? middle : 0)`.
  Clipping per the Rulings table.

- [ ] **Step 1: Write the failing tests** in `textAlong.test.ts` with synthetic items (10×10 squares standing on the baseline, y −10..0, length 10, `middle` 2) so no font is involved:
  - `items follow a straight path in order`: path `M0 0 L100 0`, 3 items, default effect → part centers x 5, 15, 25 at
    y −5, unrotated.
  - `align and start`: `{ align: 'center', start: 0.5 }` → middle item centered at x 50; `{ align: 'end', start: 1 }`
    → last item ends at 100.
  - `shift raises the line`: `{ shift: 4 }` → every part 4 higher.
  - `anchor center sits items on their middle`: `{ anchor: 'center' }` → parts 2 lower than baseline.
  - `clip drops items past an open path's end`: 15 items on a 100 path → 10 kept.
  - `fit squeezes them in`: same with `{ overflow: 'fit' }` → 15 kept, the last ends at ≈ 100.
  - `a closed path wraps past its seam`: a 100×100 square path, `{ start: 0.95 }`, 4 items → items on both sides of
    the seam, none dropped; 50 items → those a full 400 past the first dropped.
  - `side 'auto' reads left to right below a curve, 'path' and 'flipped' override`: a bottom arc path (a `U`):
    `'auto'` → first part's x < last part's x and upright (angle ≈ 0 at the bottom); `'path'` → follows the path's
    own direction; `'flipped'` → the reverse of `'path'`.
  - `an S-curve under auto turns over where the text lies`: S-curve path; text at `start: 0.1` and at `start: 0.7`
    with a short text → upright in both (compare each part's up vector with screen up).
  - `nothing to lay or nowhere to lay it paints nothing`: no items → `[]`; one-point path → `[]`; no `NaN` in any
    output coordinate for a compound path.
  - via `effectParts`: a source without `items` lays its whole outline as one item.
  - In the same file, the font-load case Task 6 deferred: a scene with `withPathEffectsRegistry`, a text node whose
    face's outlines are still loading, a `textAlong` node over it and a path → `pathEffectParts` is `null`/empty; after
    the load resolves (await it, and `notifyGlyphReady` fires through the registry) the same call returns parts.
- [ ] **Step 2:** Run `npx vitest run --project=core packages/core/src/core/scene/pathEffects/textAlong.test.ts`.
  Expected: FAIL.
- [ ] **Step 3:** Implement `textAlong.ts`; wire `effects.ts`; export `TextAlongEffect`, `PathEffectOptions`,
  `EffectItem`, `textAlongParts` through `pathEffects/index.ts` and `barrel/paths.ts` by name.
- [ ] **Step 4:** Run `textAlong.test.ts` and the Task 6 files. Expected: PASS.
- [ ] **Step 5:** Commit: `add a textAlong path effect, laying a source's items along a path with placeAlongRun`.

### Task 8: Editing hidden sources

**Files:**
- Create: `packages/core/src/features/pathEffects/effectSources.ts`, `.../effectSources.test.ts`,
  `packages/core/src/features/pathEffects/useEffectSourcesLayer.ts` (+ test)
- Modify: `packages/text-dom/src/useTextEdit.ts` (`onDraft`), `packages/core/src/features/text/textHitAt.ts`,
  `packages/core/src/features/text/useSceneTextEdit.ts`, `packages/core/src/interactions/actions/defaults/enterPathEdit.ts`,
  the SceneCanvas file that mounts `useDepartureGhostLayer` (mount the new layer beside it), core barrel by name

**Interfaces:**
- Produces: `effectSourceFor(scene, id: NodeId, role: 'text' | 'path'): NodeId | null` — for a path-effect node with
  `hideSources`, its source 0 when that is text (`role: 'text'`) or its path source (source 1 for the along kinds, 2
  for a blend; `role: 'path'`); `null` otherwise. The one answer every edit route asks.
- Produces: `UseTextEditOptions.onDraft?: (id: string, draft: { text: string; runs?: readonly StyledRun[] }) => void`,
  fired on each `input`.
- Behavior:
  - `textHitAt` also hits a visible path-effect node whose derived path contains the point and whose
    `effectSourceFor(…, 'text')` is a text node, answering that source's id with caret at the end of its text. The
    overlay opens at the source's own pose — it already does, from the source's painted pose.
  - `useSceneTextEdit` writes each draft through `scene.update` when `scene.removalClosure([id])` holds anything but
    `id`'s own subtree (something derives from it), and on cancel restores the data the edit began with.
  - `enterPathEditAction`, from the selection, resolves an effect through `effectSourceFor(…, 'path')` and edits that
    path. Its double-click binding on the effect itself does not (the double-click is the text's).
  - `useEffectSourcesLayer`: for each selected path-effect node with `hideSources`, the world silhouettes of its
    hidden sources drawn as a 1-screen-px stroke in the `'chrome'` overlay color at 40% opacity, under the selection
    chrome.

- [ ] **Step 1: Write the failing tests:**
  - `effectSources.test.ts`: `effectSourceFor` → text source for `'text'`, path source for `'path'` (along kinds and a
    blend with a spine), `null` for an effect without `hideSources` and for a non-effect.
  - `textHitAt` case (in its existing test file or `useSceneTextEdit.test.ts`): a hidden text source under a
    `textAlong` node — a point on the curved glyphs answers the source's id; a point on the hidden source's own box
    answers `null`.
  - `useTextEdit` (`useTextEdit.commit.test.ts` style): typing fires `onDraft` with the overlay's text each input.
  - `useSceneTextEdit`: editing a node something depends on updates `scene.get(id).data.text` on each input; cancel
    restores the original; a node nothing depends on is not written until commit (existing behavior unchanged).
  - `enterPathEdit.test.ts`: with a `textAlong` (`hideSources`) node selected and invoked without coordinates, sets
    `editingId` to the path source.
  - `useEffectSourcesLayer` test: draws two stroke commands for a selected text-along node with hidden sources, none
    when it is not selected or `hideSources` is unset.
- [ ] **Step 2:** Run each file with `--project=core` / `--project=weasel-ui` as `check:test-projects` says. FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same files plus `useSceneTextEdit.test.ts`, `useTextEdit.commit.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `edit a path effect's hidden text and path through the effect, and show them faintly when it is selected`.

### Task 9: path-tools — Text Along Path and its family

**Files:**
- Modify: `packages/path-tools/src/pathEffects/actions.ts`, `params.ts`, `settingsForm.ts`, `spine.ts` (or a new
  `pathEffects/retarget.ts` if `spine.ts` would pass ~200 lines), `packages/path-tools/src/presets.ts`,
  `packages/path-tools/src/index.ts`, `packages/path-tools/icons/tools.mjs` (+ `npm run gen:icons` output),
  `packages/path-tools/src/pathEffects/pathEffects.test.ts`
- Modify: `packages/core/src/interactions/actions/…` delete action (find the one `Delete` routes to) for the hidden-
  source rule

**Interfaces:**
- Produces: `textAlongAction` (id `'textAlong'`, label `'Text Along Path'`, icon `icon('textAlong')`, Alt+Shift+T,
  `code: 'KeyT'` — check `BROWSER_RESERVED_CHORDS` and the existing bindings first; pick another letter if taken).
  Enabled on exactly two selected leaves of which one is text (`isTextData`) and the other is not; sources ordered
  `[text, path]` whatever the selection order; `EFFECT_DEFAULTS.textAlong = { kind: 'textAlong', hideSources: true }`;
  inserted above the upper source; both sources hidden in the same `commitOps` batch with `createSetHiddenOp`.
  `createEffectAction`'s spec grows an `order?(leaves)` and a `hides?: boolean` rather than a second create routine.
- Produces: `releasePathEffectAction` (id `'releasePathEffect'`, label `'Release'`, group `PATH_EFFECTS_GROUP`):
  per selected effect, delete it and unhide sources it hid, one batch; selects the sources.
- Produces: `setEffectPathAction` (id `'setEffectPath'`, label `'Set Path'`): an along-kind effect and one other leaf
  selected → source 1 becomes that leaf; with `hideSources`, the old path is unhidden and the new one hidden; one
  batch. Disabled where it would make a cycle (reuse `spineTarget`'s closure check by extracting it).
- `effectSettings('textAlong', p)` reads `align`, `start` (clamped 0..1), `shift`, `anchor`, `overflow`, `side`.
  `settingsForm`: a `textAlong` section ("Text Along Path", count key `texts`), fields Align (toggle), Start (slider
  0..1 step 0.01), Shift (input), Anchor (toggle Baseline/Center), Overflow (toggle Clip/Fit), Side (toggle
  Auto/Path/Flipped); defaults `{ align: 'start', start: 0, shift: 0, anchor: 'baseline', overflow: 'clip', side: 'auto' }`.
- `expandPathEffectAction` and the core delete action: an effect with `hideSources` takes its hidden sources with it,
  in the same batch.
- `pathEffectsPreset.actions` gains `textAlongAction`, `releasePathEffectAction`, `setEffectPathAction`.
- Glyph `textAlong` in `tools.mjs` beside `bendAlong`: a curve with letterforms standing on it. Follow CLAUDE.md
  "Drawing icons": proof at 240–320px, check at 16px 1× and 2× on the pixel grid, post every render with `transom post`.

- [ ] **Step 1: Write the failing tests** in `pathEffects.test.ts` (its existing scene helpers):
  - `Text Along Path orders text first and hides both`: select path then text, run → one new node, `dependsOn
    [text, path]`, both sources `isHidden`, one undo restores all three as they were.
  - `it needs one text and one non-text leaf`: two rects → disabled; two texts → disabled.
  - `Release deletes the effect and shows its sources`: → sources visible and selected, effect gone; undo brings back.
  - `Set Path moves the hidden flag to the new path`.
  - `Expand to Paths takes hidden sources with it`; `Delete takes hidden sources with it`; an effect without
    `hideSources` leaves its sources (existing behavior).
  - `the settings form reads and writes the text-along fields`: `readPathEffectSettings` shows `textAlong.side`, and
    `editPathEffect` with `{ kind: 'textAlong', side: 'flipped' }` writes it.
- [ ] **Step 2:** Run `npx vitest run --project=<path-tools project> packages/path-tools/src/pathEffects/pathEffects.test.ts`.
  Expected: FAIL.
- [ ] **Step 3:** Implement; `npm run gen:icons`; biome on touched files.
- [ ] **Step 4:** Run the test file and the delete action's test file. Expected: PASS.
- [ ] **Step 5:** Commit: `add Text Along Path to path-tools, with Release and Set Path for along effects`.

### Task 10: draw

**Files:**
- Modify: `apps/draw/src/svgEffects.ts` (`EFFECT_KINDS` gains `'textAlong'`), `apps/draw/src/modality/useCanvasModes.ts`
  (`pathToEdit` resolves through `effectSourceFor`), `apps/draw/src/pathEffects.test.ts`, menus if the Effects menu
  lists actions by id
- Test: `apps/draw/src/pathEffects.test.ts`

**Interfaces:**
- Consumes: Tasks 7–9.

- [ ] **Step 1: Write the failing tests** in `pathEffects.test.ts`: a draw document holding a text node, a path and a
  `textAlong` node with hidden sources survives `toJSON` → `nodeSpecsFromSnapshot` with its sources still hidden and
  its parts the same; and its SVG export → `openSvgText` round-trip keeps the effect live.
- [ ] **Step 2:** Run it with `--project=` draw's project. Expected: FAIL on `EFFECT_KINDS`.
- [ ] **Step 3:** Implement; confirm the action reaches draw's menus/action bar the way Bend Along does.
- [ ] **Step 4:** Run. Expected: PASS. Commit: `open, save and edit text along a path in draw`.
- [ ] **Step 5: Look at it.** From the worktree, `WAKE_EXTRA=<free port> npm run dev -w apps/draw` (or the draw dev
  script the README names), drive headless with chrome-devtools, and screenshot each, posting every image with
  `transom post <file>` (zone `weasel`): text along an open path; along an ellipse and a rect, wrapping past the seam;
  an S-curve with side auto / path / flipped; Release; Undo; double-click the curved text, type, see it follow; Enter
  path edit on the effect and move an anchor. Fix what looks wrong before calling the task done.

### Task 11: ui — a label along an Along arc

**Files:**
- Create: `packages/ui/src/components/Along/lab/CurvedLabel.stories.tsx`, `CurvedLabelView.tsx`,
  `CurvedLabelView.browser.test.tsx`, a `.module.css` for it

**Interfaces:**
- Consumes: `placeAlongRun`, `arcShape`, `trackRun`, `arcInBox`, `placeOnRun`'s CSS properties (via `onRun.module.css`).

- [ ] **Step 1: Write the failing browser test**: render `CurvedLabelView` with a label string on a top arc and a
  bottom arc; measure each character span's `offsetWidth`; assert each span's on-screen center (from
  `getBoundingClientRect`) is within 1px of `placeAlongRun(run, widths, { align: 'center' })[i].point` (offset by the
  view's box) and that on the bottom arc the spans still read left to right.
- [ ] **Step 2:** The view splits the label into grapheme spans (`Intl.Segmenter`), measures them after layout,
  and places each with `placeAlongRun` and the `onRun` CSS properties — no new public component.
- [ ] **Step 3:** Biome; commit `show a label laid along an Along arc with placeAlongRun, in a ui lab story`; run
  `npm run test:fleet -- HEAD` for the browser file.
- [ ] **Step 4: Look at it** in forge headless; screenshot both arcs; `transom post`.

### Task 12: Close out (controller)

- [ ] Changeset (`patch`) naming geom, ui, text, text-dom, core, path-tools: what was added, and that ui's
  `runPlaces` now comes from geom.
- [ ] Durable notes into package docs: geom track README (or the doc that owns `track/`) — the place primitive and the
  `'path'` shape; core path-effects docs — `textAlong` options, one line only, wrapped text's later lines dropped,
  color glyphs keep their advance and paint nothing, decorations not drawn.
- [ ] `docs/TODO.md`: retire anything this shipped; file decorations along a path, a curved-label component, Repeat
  Along onto `placeAlongRun`, and Bend Along / Repeat Along taking `hideSources` in their create actions.
- [ ] Delete the design doc and this plan.
- [ ] `npm run test:gate`-equivalent on the fleet: `npm run test:fleet -- HEAD` and `npm run test:fleet:postbuild -- HEAD`,
  both matching the branch head; rebase on `main` if it moved and re-run; merge `--ff-only`; `npm run test:fleet -- main`.
