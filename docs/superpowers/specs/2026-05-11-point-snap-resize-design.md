# Point-snap behaviors for resize

**Status:** design
**Tier:** 1.5 (small additive hook — but non-trivial math)
**Source TODO:** `docs/TODO.md` → "Point-snap behaviors for resize/move"

## Problem

Today `ResizeBehavior` operates on local-frame bounds (`x, y, width, height`). For axis-aligned rects this is fine — rounding `x+width` to a grid spacing rounds the world-space east edge to the grid. For **rotated** rects the same math snaps a local-frame coordinate that does not correspond to any world grid line; the visible dragged corner ends up between grid intersections.

A separate `PointSnapBehavior` slot lets a behavior snap a *world-space anchor point* (the dragged corner, the AABB center, the pose origin, or the fixed corner) to a target. The hook back-solves the local pose so the chosen anchor lands on the snap. For unrotated rects this overlaps existing bounds-frame snapping (deliberately — consumer picks one or the other). For rotated rects it is the only correct interpretation of "snap to grid."

## Goals

- New `pointSnapBehaviors: PointSnapBehavior<TPose>[]` slot on `useResize`, fired after bounds-frame behaviors.
- Supports four frames: `'dragged-corner' | 'fixed-corner' | 'center' | 'origin'`.
- Hook performs the back-solve to translate/reshape the local pose so the chosen frame's world point lands on the snap.
- Works for both axis-aligned and rotated poses (`ResizePose` and `RotatedPose`).
- Ship a built-in factory `pointSnapToGrid({ spacing, frame?: 'dragged-corner', bypassKey? })` that exercises the v1 surface.

## Non-goals

- `useMove` integration. Move's snap already routes through `gridSnapStrategy` on a single drag handle; point-snap doesn't add value there. Defer.
- Auto-consuming `ctx.gridSnapStrategy`. Explicit `pointSnapToGrid()` only; consumer wires it like any other behavior.
- Edge-drag handling for `dragged-corner` / `fixed-corner` frames. Edges have no single point. When `anchor.x === 'free'` or `anchor.y === 'free'`, those two frames are `null` in the context — a behavior keying off them no-ops. `center` and `origin` fire on every drag, including edges.

## API

### Types (`src/interactions/gestures/types.ts`)

```ts
/** Frames a point-snap behavior can return for the hook to back-solve. */
export type PointSnapFrame = 'dragged-corner' | 'fixed-corner' | 'center' | 'origin';

/** Per-frame world-space context handed to `PointSnapBehavior.onMove`. */
export interface PointSnapContext<TPose extends ResizePose> {
  /** World-space anchor points derived from the proposed pose + rotation.
   *  `draggedCorner` and `fixedCorner` are `null` when the drag is an
   *  edge (one of `anchor.x` / `anchor.y` is 'free'); the corner isn't
   *  well-defined. */
  draggedCorner: { worldX: number; worldY: number } | null;
  fixedCorner: { worldX: number; worldY: number } | null;
  center: { worldX: number; worldY: number };
  origin: { worldX: number; worldY: number };
  rotation: number;
  anchor: ResizeAnchor;
  proposed: TPose;
  modifiers: ModifierState;
}

/** Per-frame snap result. A behavior returns at most one. */
export interface PointSnapResult {
  frame: PointSnapFrame;
  worldX: number;
  worldY: number;
}

/** A point-snap behavior plugged into `useResize`. */
export interface PointSnapBehavior<TPose extends ResizePose> {
  id?: string;
  onMove(ctx: PointSnapContext<TPose>): PointSnapResult | null | undefined;
}
```

### `useResize` option

```ts
interface UseResizeOptions<TPose> {
  // ...existing...
  /** Behaviors that operate on world-space anchor points. Fire after
   *  `behaviors[]` (bounds-frame). Each behavior returns at most one
   *  snap; the hook applies the FIRST non-null result and skips the rest. */
  pointSnapBehaviors?: PointSnapBehavior<TPose>[];
}
```

### Built-in factory

```ts
// src/interactions/actions/resize/behaviors/pointSnapToGrid.ts
export function pointSnapToGrid<TPose extends ResizePose>(args: {
  spacing: number;
  frame?: PointSnapFrame;   // default 'dragged-corner'
  bypassKey?: keyof ModifierState;
}): PointSnapBehavior<TPose>;
```

Default `frame: 'dragged-corner'` matches the dominant use case.

## Lifecycle

Inside `useResize`'s `onMove` callback, after running `behaviors[]`:

1. Compute `PointSnapContext` from the post-`behaviors[]` proposed pose:
   - `center = (pose.x + pose.w/2, pose.y + pose.h/2)` (local; world = same since center is the rotation pivot).
   - Local corners → rotate by `rotation` about `center` → world corners.
   - Map `anchor` to which corner is dragged vs fixed:
     - `anchor=(min,min)` → fixed=(min,min)=top-left, dragged=(max,max)=bottom-right.
     - `anchor=(max,min)` → fixed=top-right, dragged=bottom-left.
     - `anchor=(min,max)` → fixed=bottom-left, dragged=top-right.
     - `anchor=(max,max)` → fixed=bottom-right, dragged=top-left.
     - If `anchor.x === 'free'` or `anchor.y === 'free'`: both corner frames → `null`.
   - `origin` (world): rotate local `(pose.x, pose.y)` about `center` (where `(pose.x, pose.y)` reads as a corner relative to center, same as top-left).
2. Run `pointSnapBehaviors` in order. First non-null result wins.
3. Apply back-solve (see below) to produce a new pose. Replace the proposed pose with the snapped one.
4. Subsequent code in `onMove` (overlay publish, leaf-pose computation) runs against the snapped pose.

### Back-solve by frame

Given snap target `G = (Gx, Gy)` and the proposed pose's frame points:

**`dragged-corner`** (most common):
- Fixed corner `F` stays at its current world position.
- New rectangle = the rect whose two diagonally-opposite corners are `F` (fixed) and `G` (snapped dragged corner), in the rotated local frame.
- Math:
  1. Diagonal vector `D = G - F` in world space.
  2. Project `D` onto the local x-axis `(cos θ, sin θ)` → new `width` (sign indicates which side of fixed).
  3. Project `D` onto local y-axis `(−sin θ, cos θ)` → new `height`.
  4. New `(x, y)` = position such that the fixed corner stays at `F`. Compute new center = `F + rotate((±w/2, ±h/2), θ)` where signs match the fixed-corner anchor; then `pose.x = center.x − w/2`, `pose.y = center.y − h/2`.
- Width/height may end up negative if `G` crosses the fixed corner — abs them and flip the anchor (existing useResize already handles anchor-flip; we re-use that).

**`fixed-corner`**:
- Mirror of dragged-corner: dragged corner stays, fixed corner snaps. Same back-solve with the roles swapped.
- Less common but the math is symmetric.

**`center`**:
- The proposed pose's width/height stay. Translate the pose so its world-space center lands on `G`.
- `delta = G - oldCenter`. New `pose.x = pose.x + delta.x`; new `pose.y = pose.y + delta.y`. Rotation unchanged.

**`origin`**:
- The pose's `(x, y)` IS the local-frame origin (top-left of the unrotated AABB).
- World origin = `rotate((-w/2, -h/2), θ) + center`. To land world origin on `G`, translate by the world delta: equivalent to `pose.x` += `(Gx − worldOrigin.x)`, `pose.y` += `(Gy − worldOrigin.y)` (since rotation is rigid, the world-delta equals the local-delta on `(pose.x, pose.y)`).

## Files touched

- Modify: `src/interactions/gestures/types.ts` — add `PointSnapFrame`, `PointSnapContext`, `PointSnapResult`, `PointSnapBehavior`.
- Modify: `src/interactions/actions/resize/resize.ts` — accept option; build context; run behaviors; back-solve.
- Create: `src/interactions/actions/resize/behaviors/pointSnapToGrid.ts` — built-in factory.
- Test: `src/interactions/actions/resize/resize.test.ts` (or its corner-cases test file) — new section.
- Test: `src/interactions/actions/resize/behaviors/pointSnapToGrid.test.ts` — new file.
- Modify: `src/interactions/actions/resize/behaviors/index.ts` — re-export `pointSnapToGrid`.
- Modify: `src/index.ts` — re-export the new types + factory at the kit barrel.
- Modify: `demo/demos/RotateDemo.tsx` or create `demo/demos/PointSnapDemo.tsx` — demonstrate corner-snap on a rotated rect.
- Modify: `docs/TODO.md` — mark entry shipped.

## Tests

Against a mock adapter with a single 100×60 rect at (0,0):

1. **Axis-aligned, dragged-corner snap to grid 50**: drag bottom-right to (123, 47); behavior snaps dragged corner to (100, 50). Result pose `{x:0, y:0, w:100, h:50}`.
2. **Rotated 45°, dragged-corner snap to grid 50**: rotate 45°, drag bottom-right; behavior snaps world dragged corner to a grid intersection; assert back-solve yields a pose whose world dragged corner equals the snap target within float tolerance.
3. **Center snap**: behavior returns `center` frame; assert pose translated so center == G, width/height unchanged.
4. **Origin snap**: behavior returns `origin` frame; assert pose's world origin == G, width/height unchanged.
5. **Edge drag**: behavior keys off `draggedCorner`; on an edge resize (`anchor.x === 'free'`), `draggedCorner` is `null`; behavior returns null; pose passes through unchanged.
6. **Multiple behaviors**: first returns null, second returns dragged-corner snap; assert the snap is applied.
7. **bypassKey**: `pointSnapToGrid({ spacing: 50, bypassKey: 'meta' })` with `modifiers.meta = true` skips the snap.
8. **Negative width crossover**: drag bottom-right past the top-left fixed corner; back-solve produces positive width/height and the anchor flips (matches existing useResize anchor-flip semantics).

For `pointSnapToGrid.test.ts`: unit-test the factory in isolation — feed it a synthetic `PointSnapContext` and assert the returned `PointSnapResult`.

## Demo

Adapt `RotateDemo` (or new `PointSnapDemo`):
- Single 100×60 rect at angle 30°.
- Wire `useResize` with `pointSnapBehaviors: [pointSnapToGrid({ spacing: 20 })]`.
- Render a 20×20 grid overlay so the user can see snapping land on intersections.
- Hint: "Drag the bottom-right handle. The dragged corner snaps to the 20-unit grid in world space."

## Done criteria

- `npm run prepublishOnly` clean.
- All 8 new tests green.
- Demo manually verified: dragging a corner of the rotated rect produces a pose whose world-space dragged corner sits exactly on a grid intersection.
- Existing useResize tests untouched and green (no regression on bounds-frame behaviors).

## Follow-ups (defer)

- `useMove` adoption — when a real consumer wants a configurable drag-handle point on move (e.g. snap the rect's center to grid rather than its origin).
- `gridSnapStrategy` auto-consume on `useResize` — when bounds-frame `snapToGrid` is retired or made redundant.
- Edge-drag interpretation — snap the perpendicular projection of one specific corner of the edge (configurable).
