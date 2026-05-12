# Point-Snap Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `pointSnapBehaviors` slot to `useResize` so a behavior can snap a world-space anchor point (dragged-corner / fixed-corner / center / origin) to a target; the hook back-solves the local pose so the chosen frame's world point lands on the snap. Critical for snapping rotated rects to a grid.

**Architecture:** New behavior type `PointSnapBehavior<TPose>` parallel to `ResizeBehavior`. Inside `useResize.onMove`, after running `behaviors[]`, build a `PointSnapContext` from the proposed pose + rotation, run `pointSnapBehaviors[]`, apply per-frame back-solve to the first non-null result. Plus one built-in factory `pointSnapToGrid`.

**Tech Stack:** TypeScript, React hooks, Vitest, weasel kit.

**Spec:** `docs/superpowers/specs/2026-05-11-point-snap-resize-design.md`

---

## File map

- Modify: `src/interactions/gestures/types.ts` — new types.
- Modify: `src/interactions/gestures/resize/resize.ts` — context build + back-solve.
- Create: `src/interactions/gestures/resize/behaviors/pointSnapToGrid.ts`.
- Modify: `src/interactions/gestures/resize/behaviors/index.ts` — re-export.
- Modify: `src/index.ts` — re-export new types + factory at the kit barrel.
- Test: `src/interactions/gestures/resize/resize.test.ts` (or `resize.points.test.ts`) — 8 tests.
- Test: `src/interactions/gestures/resize/behaviors/pointSnapToGrid.test.ts` — unit tests.
- Modify or create: `demo/demos/PointSnapDemo.tsx` — rotated rect + grid + snap.
- Modify: `demo/registry.ts` — register demo (if new).
- Modify: `docs/TODO.md` — strike Tier 1.5 entry.

---

## Task 1: Add types

**Files:**
- Modify: `src/interactions/gestures/types.ts`

- [ ] **Step 1.1: Append to types.ts** (place after the existing `ResizeMoveResult` block around line 124)

```ts
// ----- point-snap (used by useResize's pointSnapBehaviors slot) -----

/** Frames a point-snap behavior can return for the hook to back-solve. */
export type PointSnapFrame = 'dragged-corner' | 'fixed-corner' | 'center' | 'origin';

/** Per-frame world-space context handed to `PointSnapBehavior.onMove`.
 *  `draggedCorner` and `fixedCorner` are `null` for edge drags
 *  (`anchor.x === 'free'` or `anchor.y === 'free'`). `center` and
 *  `origin` are always present. */
export interface PointSnapContext<TPose extends ResizePose> {
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

/** A point-snap behavior plugged into `useResize`'s `pointSnapBehaviors`. */
export interface PointSnapBehavior<TPose extends ResizePose> {
  id?: string;
  onMove(ctx: PointSnapContext<TPose>): PointSnapResult | null | undefined;
}
```

- [ ] **Step 1.2: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 1.3: Commit**

```bash
git add src/interactions/gestures/types.ts
git commit -m "feat(resize): types for PointSnapBehavior" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Hook plumbing + back-solve + tests (TDD)

**Files:**
- Modify: `src/interactions/gestures/resize/resize.ts`
- Test: `src/interactions/gestures/resize/resize.test.ts` (or a new `resize.pointSnap.test.ts` if the existing file is unwieldy — let the implementer judge)

- [ ] **Step 2.1: Read the existing hook**

Read `src/interactions/gestures/resize/resize.ts` end-to-end. Note:
- Where `behaviors[]` is iterated and the proposed pose is mutated.
- How `RotatedPose` is detected (presence of `rotation` field) vs plain `ResizePose`.
- Where the anchor is resolved (it's already passed in the proposed result).
- Where the overlay is published.

Read `src/interactions/gestures/resize/geometry.ts` too — there's likely already helpers for rotating local→world. Reuse them.

If no rotation helpers exist, add a small local function in `resize.ts` (or a new `src/interactions/gestures/resize/pointSnapBackSolve.ts` helper file).

- [ ] **Step 2.2: Write the failing tests**

Add a new `describe('useResize point-snap behaviors', ...)` block. Test cases (each one acts via the public hook lifecycle — call `onStart` / `onMove` / `onEnd` and observe ops or the overlay's `currentPose`):

```ts
// Axis-aligned, dragged-corner snap to grid 50.
it('snaps dragged corner of axis-aligned rect to nearest 50', () => {
  // Origin pose {x:0, y:0, w:100, h:60}; anchor=(min,min); drag bottom-right toward (123, 47).
  // behavior returns frame:'dragged-corner', worldX:100, worldY:50.
  // Assert final overlay/op pose has w:100, h:50, x:0, y:0.
});

// Rotated 45°, dragged-corner snap.
it('snaps world dragged corner of a rotated rect onto a grid intersection', () => {
  // Pose {x:0, y:0, w:100, h:60, rotation: Math.PI/4}; drag bottom-right.
  // behavior snaps the world-space dragged corner to (G,G) where G is a grid intersection.
  // Compute expected pose's world dragged corner; assert it equals (G,G) within 1e-6.
});

// Center snap.
it('center snap translates the pose without resizing', () => {
  // proposed pose {x:0, y:0, w:100, h:60, rotation:0}; behavior returns center frame at (200, 100).
  // Assert final pose w:100, h:60; final pose.x = 150, y = 70 (so center lands at 200,100).
});

// Origin snap.
it('origin snap translates the pose without resizing (axis-aligned)', () => {
  // proposed pose {x:0, y:0, w:100, h:60, rotation:0}; behavior returns origin frame at (40, 30).
  // Assert final pose.x = 40, y = 30; width/height unchanged.
});

// Edge drag — dragged-corner is null.
it('edge drag: draggedCorner is null in context, behavior keyed off it returns null, pose passes through', () => {
  // anchor=(min,'free'); proposed pose changed by user input.
  // behavior: ctx => ctx.draggedCorner ? {...} : null  (returns null).
  // Assert pose unchanged by point-snap path.
});

// Multi-behavior — first null, second returns snap.
it('iterates pointSnapBehaviors in order; first non-null result wins', () => {
  // [b1, b2]; b1 returns null; b2 returns dragged-corner snap.
  // Assert pose reflects b2's snap.
});

// bypassKey on the built-in factory.
it('pointSnapToGrid honors bypassKey', () => {
  // Use pointSnapToGrid({ spacing: 50, bypassKey: 'meta' }) with modifiers.meta=true.
  // Assert pose unchanged.
});

// Anchor flip on crossover.
it('back-solve flips anchor when dragged corner crosses fixed corner', () => {
  // anchor=(min,min); fixed at (0,0); drag bottom-right toward (-30, -20); behavior snaps to (-30, -20).
  // Expect width=30, height=20, x=-30, y=-20, and the final anchor presented to subsequent behaviors as flipped — OR (if anchor flip already happens upstream of point-snap, in the bounds-frame stage), just assert positive width/height.
});
```

- [ ] **Step 2.3: Run tests — expect them to fail**

```
npx vitest run src/interactions/gestures/resize/
```

Expected: 8 new tests fail; existing tests pass.

- [ ] **Step 2.4: Implement the back-solve**

In `src/interactions/gestures/resize/resize.ts`:

(a) Add an option to the existing `UseResizeOptions` interface (find it — likely an `interface` or inline typed `options` arg):

```ts
pointSnapBehaviors?: PointSnapBehavior<TPose>[];
```

(b) Add a helper (top of file or in a new `pointSnapBackSolve.ts` adjacent helper file):

```ts
function rotate(pt: { x: number; y: number }, cx: number, cy: number, theta: number) {
  const dx = pt.x - cx;
  const dy = pt.y - cy;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

interface CornerWorld { worldX: number; worldY: number }

function buildPointSnapContext<TPose extends ResizePose>(
  pose: TPose,
  rotation: number,
  anchor: ResizeAnchor,
  modifiers: ModifierState,
): PointSnapContext<TPose> {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  // Local corners about center.
  const tl = rotate({ x: pose.x, y: pose.y }, cx, cy, rotation);
  const tr = rotate({ x: pose.x + pose.width, y: pose.y }, cx, cy, rotation);
  const br = rotate({ x: pose.x + pose.width, y: pose.y + pose.height }, cx, cy, rotation);
  const bl = rotate({ x: pose.x, y: pose.y + pose.height }, cx, cy, rotation);

  let dragged: CornerWorld | null = null;
  let fixed: CornerWorld | null = null;
  if (anchor.x !== 'free' && anchor.y !== 'free') {
    const fixedLocal = (anchor.x === 'min' && anchor.y === 'min') ? tl
      : (anchor.x === 'max' && anchor.y === 'min') ? tr
      : (anchor.x === 'max' && anchor.y === 'max') ? br
      : bl;
    const draggedLocal = (anchor.x === 'min' && anchor.y === 'min') ? br
      : (anchor.x === 'max' && anchor.y === 'min') ? bl
      : (anchor.x === 'max' && anchor.y === 'max') ? tl
      : tr;
    fixed = { worldX: fixedLocal.x, worldY: fixedLocal.y };
    dragged = { worldX: draggedLocal.x, worldY: draggedLocal.y };
  }
  return {
    draggedCorner: dragged,
    fixedCorner: fixed,
    center: { worldX: cx, worldY: cy },
    origin: { worldX: tl.x, worldY: tl.y },
    rotation,
    anchor,
    proposed: pose,
    modifiers,
  };
}

function applyPointSnap<TPose extends ResizePose>(
  pose: TPose,
  rotation: number,
  anchor: ResizeAnchor,
  result: PointSnapResult,
  ctx: PointSnapContext<TPose>,
): TPose {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  if (result.frame === 'center') {
    const oldCenter = ctx.center;
    const dx = result.worldX - oldCenter.worldX;
    const dy = result.worldY - oldCenter.worldY;
    return { ...pose, x: pose.x + dx, y: pose.y + dy };
  }

  if (result.frame === 'origin') {
    const oldOrigin = ctx.origin;
    const dx = result.worldX - oldOrigin.worldX;
    const dy = result.worldY - oldOrigin.worldY;
    return { ...pose, x: pose.x + dx, y: pose.y + dy };
  }

  // dragged-corner and fixed-corner: fixed corner stays at its world
  // position (for dragged-corner snap); dragged corner stays (for
  // fixed-corner snap). Diagonal vector projects onto local axes for
  // width/height.
  const pin = result.frame === 'dragged-corner' ? ctx.fixedCorner : ctx.draggedCorner;
  if (!pin) return pose; // edge drag — no-op
  const target = { worldX: result.worldX, worldY: result.worldY };
  // Diagonal G - P in world space.
  const Dx = target.worldX - pin.worldX;
  const Dy = target.worldY - pin.worldY;
  // Project onto local axes: x-axis = (cos, sin), y-axis = (-sin, cos).
  const localW = Dx * cos + Dy * sin;
  const localH = -Dx * sin + Dy * cos;
  const newWidth = Math.abs(localW);
  const newHeight = Math.abs(localH);
  // Sign tells which side of pin the snap landed on; combine with the
  // resize-anchor convention to determine new center.
  // For dragged-corner snap: fixed corner is pin; dragged is target.
  // Compute new center: pin and target are diagonal corners; center is
  // their midpoint in world space.
  const cx = (pin.worldX + target.worldX) / 2;
  const cy = (pin.worldY + target.worldY) / 2;
  return { ...pose, x: cx - newWidth / 2, y: cy - newHeight / 2, width: newWidth, height: newHeight };
}
```

(c) Inside `onMove` (or wherever the proposed pose finalizes), after `behaviors[]` runs:

```ts
const psbs = optsRef.current.pointSnapBehaviors;
if (psbs && psbs.length > 0) {
  const rotation = (proposedPose as RotatedPose).rotation ?? 0;
  const psCtx = buildPointSnapContext(proposedPose, rotation, anchor, ctx.modifiers);
  for (const beh of psbs) {
    const result = beh.onMove(psCtx);
    if (result) {
      proposedPose = applyPointSnap(proposedPose, rotation, anchor, result, psCtx);
      break;
    }
  }
}
```

Adjust variable names to match the surrounding code. The proposed pose at this point is the post-`behaviors[]` pose.

- [ ] **Step 2.5: Run tests — confirm green**

```
npx vitest run src/interactions/gestures/resize/
```

Expected: all green, including the new 8 tests.

- [ ] **Step 2.6: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.7: Commit**

```bash
git add src/interactions/gestures/resize/resize.ts src/interactions/gestures/resize/resize.test.ts
# (and any new helper files / split test files)
git commit -m "feat(useResize): pointSnapBehaviors slot with four-frame back-solve" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Built-in `pointSnapToGrid` factory

**Files:**
- Create: `src/interactions/gestures/resize/behaviors/pointSnapToGrid.ts`
- Create: `src/interactions/gestures/resize/behaviors/pointSnapToGrid.test.ts`
- Modify: `src/interactions/gestures/resize/behaviors/index.ts`
- Modify: `src/index.ts` — re-export `pointSnapToGrid` + new types.

- [ ] **Step 3.1: Write failing tests for the factory**

Create `pointSnapToGrid.test.ts`. Feed the factory's `onMove` a synthetic `PointSnapContext`:

```ts
import { pointSnapToGrid } from './pointSnapToGrid';

const baseCtx = {
  draggedCorner: { worldX: 123, worldY: 47 },
  fixedCorner: { worldX: 0, worldY: 0 },
  center: { worldX: 50, worldY: 30 },
  origin: { worldX: 0, worldY: 0 },
  rotation: 0,
  anchor: { x: 'min', y: 'min' } as const,
  proposed: { x: 0, y: 0, width: 123, height: 47 },
  modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
};

it('default frame is dragged-corner; rounds to spacing', () => {
  const b = pointSnapToGrid({ spacing: 50 });
  expect(b.onMove(baseCtx)).toEqual({ frame: 'dragged-corner', worldX: 100, worldY: 50 });
});

it('honors explicit frame option', () => {
  const b = pointSnapToGrid({ spacing: 20, frame: 'center' });
  expect(b.onMove(baseCtx)).toEqual({ frame: 'center', worldX: 60, worldY: 40 });
});

it('returns null when draggedCorner is null and frame is dragged-corner', () => {
  const b = pointSnapToGrid({ spacing: 50 });
  const ctx = { ...baseCtx, draggedCorner: null };
  expect(b.onMove(ctx)).toBeNull();
});

it('bypassKey suppresses snap', () => {
  const b = pointSnapToGrid({ spacing: 50, bypassKey: 'meta' });
  const ctx = { ...baseCtx, modifiers: { ...baseCtx.modifiers, meta: true } };
  expect(b.onMove(ctx)).toBeNull();
});
```

- [ ] **Step 3.2: Run tests — confirm failures**

```
npx vitest run src/interactions/gestures/resize/behaviors/pointSnapToGrid.test.ts
```

Expected: all four fail (file does not exist).

- [ ] **Step 3.3: Implement**

Create `src/interactions/gestures/resize/behaviors/pointSnapToGrid.ts`:

```ts
import type {
  ModifierState,
  PointSnapBehavior,
  PointSnapContext,
  PointSnapFrame,
  PointSnapResult,
  ResizePose,
} from '../../types';

export function pointSnapToGrid<TPose extends ResizePose>(args: {
  spacing: number;
  frame?: PointSnapFrame;
  bypassKey?: keyof ModifierState;
}): PointSnapBehavior<TPose> {
  const { spacing, frame = 'dragged-corner', bypassKey } = args;
  const round = (v: number) => Math.round(v / spacing) * spacing;

  return {
    id: `pointSnapToGrid:${frame}`,
    onMove(ctx: PointSnapContext<TPose>): PointSnapResult | null {
      if (bypassKey && ctx.modifiers[bypassKey]) return null;
      const src =
        frame === 'dragged-corner' ? ctx.draggedCorner :
        frame === 'fixed-corner' ? ctx.fixedCorner :
        frame === 'center' ? ctx.center :
        ctx.origin;
      if (!src) return null;
      return { frame, worldX: round(src.worldX), worldY: round(src.worldY) };
    },
  };
}
```

- [ ] **Step 3.4: Update barrel**

In `src/interactions/gestures/resize/behaviors/index.ts`, add:

```ts
export { pointSnapToGrid } from './pointSnapToGrid';
```

In `src/index.ts`, find the resize behaviors re-export block (search for `lockAspectWithModifier` or `clampMinSize` to locate it) and add `pointSnapToGrid` next to it. Also re-export the new types (`PointSnapBehavior`, `PointSnapContext`, `PointSnapFrame`, `PointSnapResult`) from the same area where other gesture types are re-exported.

- [ ] **Step 3.5: Run tests — confirm green**

```
npx vitest run src/interactions/gestures/resize/behaviors/pointSnapToGrid.test.ts
```

Expected: 4/4 pass.

- [ ] **Step 3.6: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3.7: Commit**

```bash
git add src/interactions/gestures/resize/behaviors/pointSnapToGrid.ts \
        src/interactions/gestures/resize/behaviors/pointSnapToGrid.test.ts \
        src/interactions/gestures/resize/behaviors/index.ts \
        src/index.ts
git commit -m "feat(resize): pointSnapToGrid built-in behavior" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: PointSnapDemo

**Files:**
- Create: `demo/demos/PointSnapDemo.tsx`
- Modify: `demo/registry.ts`

The demo shows a rotated rect with a grid overlay; user drags the bottom-right handle; the world-space dragged corner snaps to grid intersections.

- [ ] **Step 4.1: Read reference demos**

Read:
- `/Users/mike/src/weasel/demo/demos/RotateDemo.tsx` (rotated rect rendering pattern)
- `/Users/mike/src/weasel/demo/demos/ClipboardDemo.tsx` and `/Users/mike/src/weasel/demo/demos/CloneDemo.tsx` (recent demos with selection + tools wiring)
- `/Users/mike/src/weasel/src/features/grid/` — any kit-supplied grid layer.

- [ ] **Step 4.2: Implement the demo**

Build a `PointSnapDemo` that:
- Seeds one rotated rect (e.g. `{x:160, y:100, w:100, h:60, rotation: Math.PI/6}`).
- Uses `useScene` + `sceneToAdapter` + `useSelection` + `useSelectTool` (with `useResize` wired in via the standard selection-overlay corner handles).
- Passes `pointSnapBehaviors: [pointSnapToGrid({ spacing: 20 })]` to the resize hook.
- Renders a 20-unit grid as a background layer (the kit's grid feature, if it has a render-only helper, or a simple custom layer).
- Hint: "Drag the bottom-right corner. The world-space dragged corner snaps to the 20-unit grid."

(If `useResize` isn't a directly-passed option from `useSelectTool` and lives somewhere deeper in the selection overlay, the demo may need to roll its own `useResize` integration. Check `SceneCanvas` props and the selection-overlay slot — see the `selectionOverlay` slot config in any demo that already passes resize options.)

- [ ] **Step 4.3: Register**

In `demo/registry.ts`, add the import and an entry:

```ts
import { PointSnapDemo } from './demos/PointSnapDemo';
import PointSnapDemoFull from './demos/PointSnapDemo.tsx?raw';

// In the demos array:
{
  id: 'point-snap',
  title: 'Point-snap resize',
  category: 'Tools',
  description: 'useResize with pointSnapBehaviors — drag a rotated corner and watch it snap to a world-space grid intersection.',
  hint: 'Drag the bottom-right corner.',
  Component: PointSnapDemo,
  full: PointSnapDemoFull,
  path: 'demo/demos/PointSnapDemo.tsx',
},
```

- [ ] **Step 4.4: Typecheck**

```
npx tsc --noEmit
```

- [ ] **Step 4.5: Commit**

```bash
git add demo/demos/PointSnapDemo.tsx demo/registry.ts
git commit -m "demo(point-snap): rotated rect with grid point-snap" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

(Manual visual verification happens at the controller layer.)

---

## Task 5: TODO bookkeeping + release gate

- [ ] **Step 5.1: Strike entry**

In `docs/TODO.md`, find the Tier 1.5 bullet beginning `- **Point-snap behaviors for resize/move.**`. Replace with:

```
- [x] **Point-snap behaviors for resize/move.** *Shipped 2026-05-11 (resize only).* `useResize` gains a `pointSnapBehaviors: PointSnapBehavior<TPose>[]` slot that runs after `behaviors[]`. Behaviors receive a `PointSnapContext` with world-space frame points (`dragged-corner` / `fixed-corner` / `center` / `origin`) and return at most one `PointSnapResult`; the hook back-solves the local pose so the chosen frame lands on the snap. Built-in: `pointSnapToGrid({ spacing, frame?, bypassKey? })`. Demo: `demo/demos/PointSnapDemo.tsx` (`#point-snap`). Spec: `docs/superpowers/specs/2026-05-11-point-snap-resize-design.md`. Plan: `docs/superpowers/plans/2026-05-11-point-snap-resize.md`. **Open follow-up:** `useMove` adoption — deferred; move's single drag-handle point already routes through `gridSnapStrategy`. Revisit if a real consumer wants a configurable move-handle frame.
```

- [ ] **Step 5.2: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(TODO): mark point-snap resize shipped" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5.3: Release gate**

```
npm run prepublishOnly
```

Expected: tsc clean, all vitest green, tsup build success. If any failure, BLOCKED with output.

- [ ] **Step 5.4: Report**

One-line summary of files touched (count + categories) and prepublishOnly outcome.
