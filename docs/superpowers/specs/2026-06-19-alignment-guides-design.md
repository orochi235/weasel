# Alignment guides / insert snap-to-existing-edges — design

**Date:** 2026-06-19
**Status:** Approved, pending implementation
**TODO item:** "Alignment guides / insert snap-to-existing-edges" (P2, Selection/actions/UI panels)
**Originally scoped in:** `docs/specs/2026-04-30-canvas-kit-resize-insert-design.md:278`

## Problem

When a user moves, inserts, or resizes an object, there's no feedback or
snapping when its edge or center lines up with a sibling. The kit ships the
two halves of a manual-guide system — `guideSnapStrategy`
(`src/interactions/gestures/shared/strategies/guides.ts`) for snapping and
`createGuidesLayer` (`src/features/guides/layer.ts`) for rendering — but they
only operate on **manually-supplied** guide lines (`useGuides` is plain CRUD
storage), and the move-flavored snap only constrains the pose **origin**.

True alignment guides need three things the kit lacks:

1. **Auto-derivation** of candidate lines from sibling (and page) bounds.
2. **Bounds-aware matching** that aligns the moving object's *edges and
   center* against candidates — not just its origin.
3. A **transient channel** so the currently-matched line(s) render during the
   gesture without becoming permanent snap targets.

## Decisions (locked during brainstorming)

- **Gestures:** move + insert + resize.
- **Render style:** full-length lines (reuse `createGuidesLayer`); the matched
  line spans the whole canvas. Figma-style segment-between-objects rendering is
  out of scope.
- **Match targets:** sibling objects' edges + centers **and** the document/page
  edges + center.
- **Showcase:** a terse demo card (`demo/demos/AlignmentGuidesDemo.tsx`).

## Architecture

A new self-contained module `src/features/guides/alignment/`. The existing
manual-guide primitives (`guideSnapStrategy`, `useGuides`, `createGuidesLayer`,
and the three manual `snapToGuides` behaviors) are **untouched** — alignment
guides compose with `createGuidesLayer` for rendering and reuse the `Guide`
type, but the snap logic is new and independent.

```
src/features/guides/alignment/
  derive.ts       deriveAlignmentGuides(targets, opts) -> Guide[]
  match.ts        matchAlignment(bounds, candidates, tol, anchors) -> MatchResult
  behaviors.ts    move / insert / resize behavior factories
  index.ts        barrel
  derive.test.ts
  match.test.ts
  behaviors.test.ts
```

Re-exported from `src/features/guides/index.ts` and the kit barrel
(`src/index.ts`) alongside the existing guides exports.

### Shared types

```ts
/** Axis-aligned bounding box. Rotation is ignored in v1 (see Out of scope). */
export interface AlignBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

`Guide` (`{ id, axis: 'x' | 'y', offset }`) is reused verbatim from
`features/guides/types`.

## Components

### 1. Derivation — `derive.ts`

```ts
export interface DeriveAlignmentGuidesOptions {
  /** Include the document/page box's edges + center. */
  page?: AlignBounds;
  /** Emit left/right (x) and top/bottom (y) edge guides. Default true. */
  edges?: boolean;
  /** Emit centerX (x) and centerY (y) guides. Default true. */
  centers?: boolean;
}

export function deriveAlignmentGuides(
  targets: readonly AlignBounds[],
  opts?: DeriveAlignmentGuidesOptions,
): Guide[];
```

For each target AABB, emit (subject to `edges`/`centers`):

- x-axis guides at `x` (left), `x + width/2` (centerX), `x + width` (right)
- y-axis guides at `y` (top), `y + height/2` (centerY), `y + height` (bottom)

When `opts.page` is supplied, its box contributes the same set. Offsets are
deduped within an epsilon (`1e-3` world units) so overlapping sibling edges
collapse to one candidate. Ids are stable and offset-derived:
`align:${axis}:${offset.toFixed(3)}`.

The function is pure and scene-agnostic — the *consumer* enumerates sibling
bounds (excluding the dragged id) and the page box and passes them in. This
keeps the kit primitive ignorant of node payload shape, consistent with the
`adapter: unknown` philosophy.

### 2. Matching — `match.ts`

```ts
/** Which features of the moving box to test against candidates, per axis.
 *  'min' = left/top edge, 'center' = centerline, 'max' = right/bottom edge. */
export type AlignAnchor = 'min' | 'center' | 'max';

export interface AlignMatchResult {
  dx: number;
  dy: number;
  activeX: Guide | null;
  activeY: Guide | null;
}

export function matchAlignment(
  bounds: AlignBounds,
  candidates: readonly Guide[],
  worldTolerance: number,
  anchors: { x: readonly AlignAnchor[]; y: readonly AlignAnchor[] },
): AlignMatchResult;
```

Per axis, for each selected anchor compute its world offset from `bounds`
(x: min=`x`, center=`x+width/2`, max=`x+width`; y analogous). Compare against
every candidate on that axis; track the (anchor, candidate) pair with the
smallest absolute distance within `worldTolerance`. The winning pair yields the
signed delta (`candidate.offset - anchorOffset`) as `dx`/`dy` and the candidate
as `activeX`/`activeY`. No match on an axis → delta 0 and `null` active for
that axis. The two axes are independent (mirrors `guideSnapStrategy`).

Pure, no view/scene dependency — callers convert screen-px tolerance to world
units before calling (same `tolerance / meanScale(view.scale)` pattern the
existing strategies use).

### 3. Behaviors — `behaviors.ts`

Three factories mirroring the existing `snapToGuides` trio's option shapes, so
they slot into the move / insert / resize behavior arrays the same way:

```ts
interface AlignmentBehaviorBase {
  /** Live candidate lines — consumer derives from current siblings + page. */
  getCandidates: () => readonly Guide[];
  /** Publish the currently-matched line(s). Called every onMove; cleared
   *  (`[]`) on a miss and on onEnd. */
  setActiveGuides: (guides: readonly Guide[]) => void;
  tolerance?: number;            // default DEFAULT_GUIDE_TOLERANCE_PX (6)
  getView?: () => View;          // screen-px tolerance when present
  bypassKey?: keyof ModifierState;
}
```

Non-rect poses (Path, polygon) need both bounds-reading and translation, so
move/insert take an optional projection (the bounds analog of the existing
`OriginProjection`):

```ts
export interface AlignBoundsProjection<TPose> {
  boundsOf(pose: TPose): AlignBounds;
  translate(pose: TPose, dx: number, dy: number): TPose;
}
```

The rect default reads `pose.{x,y,width,height}` and returns
`{ ...pose, x: x+dx, y: y+dy }`.

- **`alignMoveBehavior(args)` → `MoveBehavior<TPose>`** — anchors
  `{ x: ['min','center','max'], y: ['min','center','max'] }`. `onMove` reads the
  moving box via `projection.boundsOf`, runs `matchAlignment`, applies the
  `dx,dy` via `projection.translate`, and publishes `[activeX, activeY]`
  (filtered). On a miss publishes `[]`. `onEnd` publishes `[]`.
- **`alignInsertBehavior(args)` → `InsertBehavior<TPose>`** — same multi-anchor
  match against the inserted pose's bounds, using the same `AlignBoundsProjection`.
- **`alignResizeBehavior(args)` → `BoundsConstraint<TPose>`** — anchors derived
  from the resize `anchor`: the moving vertical edge (`anchor.x === 'min'` →
  test `max`; `=== 'max'` → test `min`; `'free'` → skip x) and likewise for y.
  Applies the matched edge delta exactly as today's resize `snapToGuides`
  (`width += d` / `x += d; width -= d`) and publishes the active line. This is
  the same edge math as the manual resize behavior, refactored through
  `matchAlignment` single-anchor + the publish channel.

All three honor `bypassKey` (skip + clear actives while held).

### 4. Rendering

No new layer. The consumer renders active guides with the existing
`createGuidesLayer({ getGuides: getActiveGuides })`. "Active guides" is a
transient `Guide[]` the consumer holds in a **ref**; `setActiveGuides` writes
`ref.current` and `getActiveGuides` reads it. The layer's `draw` calls
`getGuides()` each frame, so a ref avoids a React re-render per pointer-move.

## Data flow (per drag frame)

```
gesture onMove
  -> behavior.onMove(ctx, proposed)
       -> getCandidates()                // consumer derives from siblings+page
       -> worldTolerance = tol / meanScale(view.scale)
       -> matchAlignment(movingBounds, candidates, worldTolerance, anchors)
       -> apply dx,dy (move/insert) or edge delta (resize) to the pose
       -> setActiveGuides([activeX, activeY].filter(Boolean))   // ref write
  -> next frame: createGuidesLayer.draw reads getActiveGuides() -> draws line(s)
gesture onEnd
  -> behavior.onEnd -> setActiveGuides([])                       // clear
```

## Demo — `demo/demos/AlignmentGuidesDemo.tsx`

Terse, single-purpose per the repo's demo conventions. A handful of rects in a
scene; move/insert/resize tools wired with the three alignment behaviors. The
demo computes `getCandidates()` by mapping every rect *except the dragged
one(s)* to `AlignBounds` and calling `deriveAlignmentGuides(bounds, { page })`,
holds `activeGuides` in a ref, and mounts `createGuidesLayer` over the active
ref. Demonstrates edge + center snapping with full-length lines against both
siblings and the page box.

## Testing

- **`derive.test.ts`** — one target yields 6 guides (3 x, 3 y); `edges:false`
  drops the 4 edge guides; `centers:false` drops the 2 center guides; `page`
  adds its 6; overlapping offsets dedup to one; ids are stable/offset-derived.
- **`match.test.ts`** — left-edge align (min→candidate), center align, right-
  edge align; nearest-candidate-wins when several are in range; the two axes
  resolve independently; no match when all features are outside tolerance;
  resize single-anchor (`anchors.x = ['max']`) snaps only the east edge.
- **`behaviors.test.ts`** — `alignMoveBehavior.onMove` returns the pose
  override and calls `setActiveGuides` with the matched lines; a miss calls
  `setActiveGuides([])`; `onEnd` calls `setActiveGuides([])`; `bypassKey` held
  skips matching and clears actives; `alignResizeBehavior` moves only the
  dragged edge and pins the anchor edge.
- **Demo** — verified visually (manual run; not part of the unit suite).

## Out of scope (v1)

- Figma-style segment rendering (line spanning only between the aligned
  objects, with end ticks / offset labels). Full-length lines only.
- Equal-spacing / distribution guides ("equal gaps" between three+ objects).
- Rotated-object alignment — derivation and matching use AABBs; a rotated
  object would align by its bounding box. Proper rotated-edge alignment is a
  follow-up.
- Arbitrary-angle / non-axis guides.
- Multi-select drag alignment of the selection's union box (v1 derives from and
  matches single moving boxes; the demo drives one box at a time).
