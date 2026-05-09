# Rotated Resize Design

**Status:** approved 2026-05-09 (informal back-and-forth in chat)
**Tracker:** `docs/TODO.md` Tier 1 — "Groupable objects" → "Resize on a rotated object still operates against the AABB (deferred — see RotateDemo description)"

## Problem

Three breakage points appear when a `RotatedPose` (`{x, y, w, h, rotation}`) carries a non-zero rotation and the user grabs a resize handle:

1. **Hit-test mismatch.** `usePointerGestures` hits handles via `cornerResizeHandles(target.bounds)` against the unrotated AABB — but `selection/overlay.ts` *draws* handles at the rotated body's corners (it composes `rotatePoint(handle, center, rotation)`). The visible handle is offset from the hit-test handle. A click on the visible handle misses.
2. **Resize math.** `useResize.move()` computes `(dx, dy) = (worldX − start.worldX, worldY − start.worldY)` and applies anchor-relative arithmetic to the AABB. The drag is interpreted in world frame; the user's pointer motion stretches the AABB along world-X/Y rather than along the rotated leaf's local axes. Visible result: dragging "down-right" on a 45°-rotated rect's visible bottom-right handle stretches the *AABB* down-right, distorting the leaf.
3. **Pivot drift.** `useRotate` keeps the rotation pivot at the AABB center. `useResize` changes the AABB, so its center moves. The diagonally opposite world-space corner that the user perceives as "anchor" doesn't stay pinned — the leaf jumps as it scales.

The kit's existing rotation story (`useRotate`, rotation handle, overlay rotation) ships these capabilities cleanly *up to the resize step*. This spec closes the resize gap.

## Goal

A single resize gesture that, when the leaf has non-zero rotation:

1. Projects the world-space drag delta into the leaf's local frame so anchor math runs in the same axis-aligned space the unrotated path uses.
2. Pins the diagonally opposite world-space corner across the entire gesture.
3. Preserves the leaf's rotation field (resize and rotate stay orthogonal).
4. Runs the existing `ResizeBehavior` pipeline against local-frame bounds, so shipped behaviors (`lockAspectWithModifier`, future clamps) work unchanged.
5. Bit-identical output to today on unrotated leaves (`rotation === 0` short-circuits to the existing math).
6. Hit-test handles align with what the overlay draws.

## Non-goals

- **Rotated paths.** No `RotatedPath` consumer or descriptor exists. The descriptor extension is shipped in a shape that generalizes to rotated paths (see §A), but the rotated-path consumer/descriptor is out of scope here.
- **Group resize on rotated children.** `expandIds` produces a multi-leaf group; if any leaf has rotation ≠ 0, the math doesn't have a canonical right answer — see §F. Dev-mode warning + fall through to today's group path; revisit as its own design.
- **Point-snap behaviors.** "Snap a world-space anchor (dragged corner / center / fixed corner) to a target" is a parallel behavior axis from local-frame bounds-clamping. Tracked in `docs/TODO.md` Tier 1.5; not designed here.
- **Center-fixed resize (alt-from-center).** Orthogonal modifier, not a rotation-specific feature. Tracked separately (no current TODO entry; surfaced in this spec's Q5 discussion).
- **Arbitrary affine transforms (skew / non-uniform world-axis scale).** Designed away in brainstorming — would require replacing `RotatedPose`'s separate `(rect, rotation)` slots with a `Mat3` and rewriting every load-bearing pose primitive. Not an extension of this work.

## Architecture

### §A — `PoseDescriptor` extension

`PoseDescriptor<TPose>` (`src/interactions/gestures/resize/geometry.ts`) gains one optional method:

```ts
export interface PoseDescriptor<TPose> {
  getBounds(pose: TPose): ResizePose;
  remapBounds(pose: TPose, src: ResizePose, dst: ResizePose): TPose;
  translate?(pose: TPose, dx: number, dy: number): TPose;
  intersectsRect?(pose: TPose, rect: ResizePose): boolean;
  lerp?(a: TPose, b: TPose, t: number): TPose;
  /** NEW. Read the pose's rotation in radians. Pivot is the AABB center
   *  (`getBounds(pose)` center). Default 0 when omitted — descriptor
   *  declares "this pose has no rotation."
   *
   *  When supplied and non-zero, `useResize` projects the drag delta into
   *  the leaf's local frame, runs anchor math there, and translates the
   *  resulting pose so the diagonally opposite world-space corner is pinned.
   *  When omitted or returning 0, the existing AABB-frame math runs
   *  unchanged. */
  getRotation?(pose: TPose): number;
}
```

Two exported descriptors:

- **`RECT_POSE_DESCRIPTOR`** (existing) — unchanged. No `getRotation`. A consumer using a plain `ResizePose` keeps today's behavior.
- **`ROTATED_POSE_DESCRIPTOR: PoseDescriptor<RotatedPose>`** (new) — supplies `getRotation: p => p.rotation`. Inherits rect-shape `getBounds` / `remapBounds` / `translate` / `intersectsRect` / `lerp` from the rect descriptor (the `RotatedPose extends ResizePose` subtype lets `RECT_POSE_DESCRIPTOR`'s methods apply directly; `remapBounds` preserves the `rotation` field via `...p` spread, which is a property worth pinning as a regression test).

Both barrel exports (`src/index.ts`) and the `/resize` subpath export `ROTATED_POSE_DESCRIPTOR` alongside the existing rect descriptor.

**Why on `PoseDescriptor`, not as a separate hook arg or a new `RotatedPoseDescriptor` interface:**

- The existing `geometry?: PoseDescriptor<TPose>` slot on `useResize` is the declared extension point for "tell the hook how to project this pose shape." Rotation is part of that projection. Splitting it across props would force consumers to wire two things in lockstep.
- A future `RotatedPath` would supply a `PoseDescriptor<RotatedPath>` whose `getBounds` returns the path's local-frame AABB and whose `getRotation` reads the path's rotation field. Same hook, different descriptor. That's the "design on paper for paths" deliverable.

### §B — Resize math

`useResize` (`src/interactions/gestures/resize/resize.ts`) reads rotation at `start()`:

```ts
const originRotation = geometry.getRotation?.(originPose) ?? 0;
const originCenter = {
  x: originBounds.x + originBounds.width / 2,
  y: originBounds.y + originBounds.height / 2,
};
// World-space position of the diagonally opposite (fixed) corner.
const fixedLocal = fixedCornerOf(originBounds, anchor);
const fixedWorld = originRotation === 0
  ? fixedLocal
  : rotatePoint(fixedLocal.x, fixedLocal.y, originCenter.x, originCenter.y, originRotation);
```

`fixedCornerOf(bounds, anchor)` returns the corner *not* moving under the gesture. The convention is set by the existing `useResize` math: `anchor.x === 'min'` keeps `x` unchanged and grows `width` by the drag delta — i.e., the *min-x edge is the fixed anchor* and the max-x edge moves. The fixed corner therefore sits at `x = bounds.x` when `anchor.x === 'min'` and at `x = bounds.x + bounds.width` when `anchor.x === 'max'`. Same for y. This is a five-line helper added next to `cornerResizeHandles`.

`move(worldX, worldY, modifiers)` branches on `originRotation`:

**Unrotated path (`originRotation === 0`):** identical to today. No new code in the hot path.

**Rotated path (`originRotation !== 0`):**

1. *Project drag delta into leaf-local frame.*
   ```ts
   const dx = worldX - start.worldX;
   const dy = worldY - start.worldY;
   const cs = Math.cos(-originRotation);
   const sn = Math.sin(-originRotation);
   const dxLocal = cs * dx - sn * dy;
   const dyLocal = sn * dx + cs * dy;
   ```
2. *Anchor-relative arithmetic on local-frame bounds.* Identical to today's `nx, ny, nw, nh` block, but using `(dxLocal, dyLocal)`. Produces `proposedBoundsLocal`.
3. *Behaviors.* Run `ResizeBehavior.onMove(ctx, { pose: proposedBoundsLocal, anchor })` exactly as today. Behaviors operate on local-frame bounds — `lockAspectWithModifier` and dimensional clamps work unchanged. The reasoning, written into a code comment: behaviors today receive bounds; for unrotated leaves world-frame and local-frame coincide; for rotated leaves we choose local-frame to keep the contract dimensional. World-grid-snap doesn't compose with rotated geometry anyway, and "point-snap" lives on its own behavior axis (out of scope; see Non-goals).
4. *Project back to TPose.* `proposedPose = geometry.remapBounds(originPose, originBounds, behavedBoundsLocal)`. The `RotatedPose` rotation field rides through the spread.
5. *Position-correct so `fixedWorld` is preserved.*
   ```ts
   const newCenter = {
     x: behavedBoundsLocal.x + behavedBoundsLocal.width / 2,
     y: behavedBoundsLocal.y + behavedBoundsLocal.height / 2,
   };
   const newFixedLocal = fixedCornerOf(behavedBoundsLocal, anchor);
   const newFixedWorld = rotatePoint(
     newFixedLocal.x, newFixedLocal.y,
     newCenter.x, newCenter.y,
     originRotation,
   );
   const correctedPose = (geometry.translate ?? defaultTranslate)(
     proposedPose,
     fixedWorld.x - newFixedWorld.x,
     fixedWorld.y - newFixedWorld.y,
   );
   ```
   `defaultTranslate(p, dx, dy)` is a fallback used when `translate` is omitted: `{ ...p, x: p.x + dx, y: p.y + dy }`. (Both shipped descriptors supply `translate` already.)

After step 5, `correctedPose`'s diagonally opposite corner is at exactly `fixedWorld`, the leaf's rotation is `originRotation`, and the local-frame width/height are `behavedBoundsLocal.width`/`.height` (modulo behavior clamps).

The lerp path mirrors today's: lerp `lastBounds → behavedBoundsLocal` to produce `currentBoundsLocal`, then run steps 4–5 against `currentBoundsLocal` to produce the visible `currentPose`. `lastBounds` stays in local frame — the lerp is dimensional, not world-positional.

`end()` writes `correctedPose` (or per-leaf remapped poses for the unrotated group path; rotated leaves don't reach end-of-group, see §F) through `createTransformOp` exactly as today.

### §C — `rotatePoint` and `fixedCornerOf` helpers

`rotatePoint(px, py, cx, cy, theta)` is referenced from `selection/overlay.ts` and `selection/overlay.ts:`'s rotated-handle path; it's currently a private import there. Promote it to `src/interactions/geometry/rotate.ts` (or wherever the kit's shared 2D geometry lives — verify during implementation; if no shared module exists, place next to `cornerHandles.ts` since both are interaction-geometry primitives) and re-export from the existing `src/interactions/gestures/resize/index.ts` if internal callers need it.

`fixedCornerOf(bounds, anchor)`:
```ts
export function fixedCornerOf(bounds: ResizePose, anchor: ResizeAnchor): { x: number; y: number } {
  return {
    x: anchor.x === 'max' ? bounds.x + bounds.width : bounds.x,
    y: anchor.y === 'max' ? bounds.y + bounds.height : bounds.y,
  };
}
```
Lives next to `cornerResizeHandles` in `resize/cornerHandles.ts`. Pure function; trivially testable.

Sanity check: `cornerResizeHandles` returns the bottom-right handle with `anchor: { x: 'min', y: 'min' }` (each handle's `anchor` records which axis edges are *fixed*). For that handle, `fixedCornerOf` returns `(x, y)` — the top-left corner. Matches.

### §D — Hit-test integration

`PointerGestureOptions.resizeTarget` (`src/interactions/usePointerGestures.ts`) return type gains `rotation?: number`:

```ts
resizeTarget?: () => { id: string; bounds: Bounds; rotation?: number } | null;
```

(Mirrors the existing `rotateTarget` return shape exactly. The precedent for this exact field on this exact callback is already in the file.)

Hit-test branch (lines 266–278, `if (resize) { ... }`):

```ts
if (resize) {
  const target = resizeTarget();
  if (target) {
    const rot = target.rotation ?? 0;
    const cx = target.bounds.x + target.bounds.width / 2;
    const cy = target.bounds.y + target.bounds.height / 2;
    for (const h of cornerResizeHandles(target.bounds)) {
      const handleCenter = rot === 0
        ? { x: h.cx, y: h.cy }
        : rotatePoint(h.cx, h.cy, cx, cy, rot);
      if (hitCornerHandle({ ...h, cx: handleCenter.x, cy: handleCenter.y }, wx, wy, radiusWorld)) {
        // ... existing dispatch path
      }
    }
  }
}
```

`cornerResizeHandles` itself stays unchanged (still emits four local-frame corner positions). The rotation pass happens at the call site, exactly mirroring `selection/overlay.ts`'s `drawHandles`.

`hitCornerHandle` is a square-radius test in world space; `radiusWorld = handleHitRadius / viewScale` already, so the radius semantics don't change under rotation.

**Selection-derived default.** Today `usePointerGestures` synthesizes a default `resizeTarget` from `selection + boundsOf` when no explicit `resizeTarget` is passed (around lines 176–188). That default needs a rotation source. Two options were weighed in brainstorming:

- *3A:* New `rotationOf?: (id: string) => number` prop, parallel to `boundsOf`.
- *3B:* Allow `boundsOf` to return `Bounds | RotatedBounds` where `RotatedBounds = Bounds & { rotation: number }`. The selection overlay already accepts this exact shape (`selection/overlay.ts`'s `rotationOf(b)` reads optional `.rotation` off bounds).

Picked **3B** — zero new props, follows the precedent already established in `selection/overlay.ts`. The synthesized `resizeTarget` reads `boundsOf(id)`, narrows to check for a `rotation` field, and forwards it.

**`SceneCanvas` wiring.** `SceneCanvas` synthesizes `boundsOf` (and `resizeTarget`) from the scene. After this change it reads rotation through `geometry.getRotation?.(pose) ?? 0` and folds it into the bounds it returns:

```ts
const boundsOf = (id: string) => {
  const node = scene.get(id);
  if (!node) return null;
  const b = geometry.getBounds(node.pose);
  const rot = geometry.getRotation?.(node.pose);
  return rot ? { ...b, rotation: rot } : b;
};
```

This keeps rotation a property of the *descriptor*, parallel to how bounds and translation already flow through. No new `SceneCanvas` props.

### §E — Unrotated path: bit-identical guarantee

The `originRotation === 0` short-circuit is the regression-prevention mechanism. Concretely:

- `start()`: when `originRotation === 0`, `fixedWorld = fixedLocal` (no `rotatePoint` call). Stored on state but not consulted in the unrotated `move` branch.
- `move()`: branches on `if (originRotation !== 0)`. Unrotated path is the existing code, character-for-character. New code lives in an `else` (or a guarded block) that only runs when rotation is non-zero.
- `end()`, `cancel()`, lerp: unaffected for unrotated leaves.

The existing `resize.test.ts` suite (~20 cases, all unrotated) runs unchanged after the work and is the regression contract.

### §F — Group resize with rotated children

`expandIds` produces a multi-leaf group. Today the group path computes `originBounds = computeUnionBounds(leafBounds)` and runs `remapBounds(leaf, originBounds, proposedBounds)` per leaf.

For this work:

- Detect at `start()` whether any expanded leaf has `geometry.getRotation?.(leafPose)` non-zero.
- If any leaf is rotated: emit a one-time `console.warn` in dev mode (gated on `import.meta.env.DEV`) with the message `"useResize: group resize with rotated leaves is not supported. Falling back to AABB-frame group resize; results will be visually incorrect for rotated leaves."` and proceed with today's group path. (Don't throw — the group resize still produces *some* output, just wrong-looking; throwing would crash the gesture mid-drag.)
- If no leaf is rotated (or `getRotation` is undefined): take today's group path with no warning.

This is explicitly a stop-gap. The full design ("scale a rotated child inside a non-rotated group rect") has multiple defensible answers — see Non-goals — and lives in its own future spec.

### §G — Demo: rotated-resize math explainer

The final piece of the work is a demo that makes the math visible. Lives at `demo/demos/RotatedResizeMathDemo.tsx` (new file). Listed on the demo index alongside `RotateDemo` and `ResizeDemo`.

**Layout.** Four panels in a 2×2 grid, each running its own miniature `<SceneCanvas>` with a single 45°-rotated rect at identical starting pose:

1. **Full math (correct).** The shipped behavior — rotated body with rotated handles. Drag a corner; the diagonally opposite corner stays pinned in world space; the leaf's rotation is preserved.
2. **No projection (counterexample 1).** Drag delta applied in world frame: the leaf's local-frame width/height change as `(dx, dy)`, without `R(−θ)`. Visible result: stretches the leaf along world axes, distorting against rotation.
3. **No position correction (counterexample 2).** Steps 1–4 applied; step 5 skipped. Visible result: leaf scales in local frame correctly, but the AABB center stays anchored, so the user's "fixed corner" *drifts*.
4. **No anchor invariant tracked (counterexample 3).** Pose's local rect modified per drag; rotation re-applied around the *new* AABB center. Visible result: leaf rotates around a different point each frame, swimming around the cursor.

**Live overlay.** Each panel prints, in a small monospace caption:
- `originAnchorWorld: (x, y)` — captured at gesture start.
- `currentAnchorWorld: (x, y)` — recomputed each frame from the live pose.
- `delta: (dx, dy)` — should be `(0, 0)` in panel 1, drifting in panels 2–4.

The visible `delta = (0, 0)` invariant is the spec-as-running-code: the math step ledger lets a reviewer confirm by watching numbers, not by re-deriving the algebra.

**Source-of-truth comments.** Each counterexample's `move()` is commented `// COUNTEREXAMPLE: skips step N (drag-delta projection)`. The full-math panel's `move()` is commented step-by-step matching §B's numbered list.

**Content.** A brief header above the grid: one paragraph explaining what the demo demonstrates ("Resize on a rotated rect requires three coordinated steps: project the drag into local frame, run anchor math, position-correct so the world anchor stays pinned. This page runs the full math next to three counterexamples that each skip one step."), with links to this spec's §B for readers who want the math.

## Sequencing

Single PR. Build order within the PR:

1. **Descriptor extension** (`src/interactions/gestures/resize/geometry.ts`).
   - Add `getRotation?` to `PoseDescriptor`.
   - Ship `ROTATED_POSE_DESCRIPTOR`.
   - Export both from `src/index.ts` and `src/resize/index.ts` (verify barrel / subpath layout during impl).
   - Tests: `getRotation` reads correctly; `remapBounds` preserves `rotation` field across remap.

2. **`fixedCornerOf` helper** (`src/interactions/gestures/resize/cornerHandles.ts`).
   - Pure-function helper next to `cornerResizeHandles`.
   - Tests: each anchor → correct fixed corner.

3. **`rotatePoint` promotion**.
   - Locate current home (currently inside `selection/overlay.ts` import path).
   - If shared, fine. If not, promote to a module shared by `selection/` and `interactions/`. (Don't manufacture a new directory; place it where the existing 2D geometry helpers live.)
   - Tests: rotation correctness against known angles (0, π/2, π, −π/2, π/4).

4. **Hook math** (`src/interactions/gestures/resize/resize.ts`).
   - Read `originRotation` at `start()`; capture `fixedWorld`.
   - Branch in `move()` between unrotated (existing) and rotated (new).
   - Apply `descriptor.translate` for position correction.
   - Group-with-rotated-leaf detection at `start()` → dev warning.
   - Tests: drag projection, anchor invariance for each of four anchors, behaviors run on local-frame bounds, flipped-pose preservation.
   - **Regression contract:** existing `resize.test.ts` cases run unchanged.

5. **Hit-test integration** (`src/interactions/usePointerGestures.ts`).
   - `resizeTarget` return type gains `rotation?`.
   - Hit branch rotates handle positions when rotation ≠ 0.
   - Selection-derived `resizeTarget` reads `rotation` off `boundsOf` return (3B).
   - Tests: rotated-corner hit at known position, AABB-corner-but-not-rotated-corner miss, unrotated path unchanged.

6. **`SceneCanvas` wiring** (`src/canvas/SceneCanvas.tsx`).
   - Read `geometry.getRotation?` and fold rotation into synthesized `boundsOf`.
   - Tests: `SceneCanvas` integration with `ROTATED_POSE_DESCRIPTOR` produces a hit-testable rotated rect.

7. **`RotateDemo` opt-in** (`demo/demos/RotateDemo.tsx`).
   - Pass `geometry={ROTATED_POSE_DESCRIPTOR}` (or merge with the existing `pickEvery` override — exact prop merge to be settled during implementation; the SceneCanvas `geometry` prop currently accepts a partial-extension shape).
   - Manual smoke: click rotated handle → drag → release. Verify pose, then verify subsequent rotation around the new AABB center has no pivot drift relative to the resized leaf.

8. **Math explainer demo** (§G; `demo/demos/RotatedResizeMathDemo.tsx`).
   - Implement four panels per §G.
   - Add to demo index.

`prepublishOnly` (`tsc --noEmit && vitest run && tsup build`) green at the end. Manual demo soak before merge.

## Risk surface

The single regression risk is breaking unrotated resize. Mitigations:

- The `originRotation === 0` short-circuit in §B/§E makes the rotation-aware branch literally unexecuted for unrotated callers.
- The existing `resize.test.ts` suite runs unchanged.
- Hit-test rotation pass is gated on `rot !== 0`; unrotated branch identical to today.

A secondary risk is the `rotatePoint` promotion churning imports across files. Mitigation: keep the function name and signature identical to its current private call site; only the import path changes. Run `tsc --noEmit` after the move.

## Open implementation questions

(Surfaced during brainstorming; resolved at implementation time, not gating spec approval.)

- **`rotatePoint` home.** If a shared 2D-geometry module already exists, use it. If not, the simplest landing spot is `src/interactions/gestures/rotate/geometry.ts` (already exports `rotatedRectCorners`, `aabbCenter` — same flavor of helper). Implementer decides during step 3.
- **`SceneCanvas` `geometry` prop merge.** `RotateDemo` currently passes `geometry={{ pickEvery }}`. Step 7 needs the prop to accept either a `PoseDescriptor` extension or the `pickEvery` extension or both. Verify the current `SceneCanvas` prop shape during step 7; if it's not already an intersection, this is a small SceneCanvas-internal change, not a design change.
- **Group-with-rotated-leaf warning de-dup.** Dev `console.warn` should fire once per gesture, not per `move()` frame. Use a flag on state.
