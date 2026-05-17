# Rotated Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resize on a rotated `RotatedPose` works in the leaf's local frame and pins the diagonally opposite world-space corner; hit-test handles align with the overlay's drawn handles. Spec: `docs/superpowers/specs/2026-05-09-rotated-resize-design.md`.

**Architecture:** Extend `PoseDescriptor<TPose>` with optional `getRotation?(pose): number`. Ship `ROTATED_POSE_DESCRIPTOR`. Branch `useResize.move()` on origin rotation: project drag delta into local frame via `R(−θ)`, run today's anchor math on local-frame bounds, then translate the resulting pose so the fixed corner stays at its origin world position. Hit-test branch in `usePointerGestures` rotates the four corner-handle positions about AABB center before testing — exactly how the overlay's `drawHandles` already places visible handles. Bit-identical short-circuit when `rotation === 0`.

**Tech Stack:** React 18+, TypeScript strict, Vitest, `@testing-library/react`. No new runtime deps.

---

## File map

**Modify:**
- `src/interactions/actions/resize/geometry.ts` — add `getRotation?` to `PoseDescriptor`; add `ROTATED_POSE_DESCRIPTOR`.
- `src/interactions/actions/resize/cornerHandles.ts` — add `fixedCornerOf` helper.
- `src/interactions/actions/resize/resize.ts` — read rotation at start, branch math in move, position-correct via `descriptor.translate`, dev warning for group-with-rotated-leaves.
- `src/interactions/actions/resize/index.ts` — re-export `ROTATED_POSE_DESCRIPTOR` and `fixedCornerOf`.
- `src/interactions/usePointerGestures.ts` — `resizeTarget` return shape gains `rotation?`, hit-test branches on rotation, synthesized resizeTarget reads rotation from `boundsOf`.
- `src/canvas/Canvas.tsx` — synthesized `baseBoundsOf` folds `geometry.getRotation?.(pose)` into the result.
- `src/index.ts` — re-export `ROTATED_POSE_DESCRIPTOR`.
- `demo/demos/RotateDemo.tsx` — pass `geometry={ROTATED_POSE_DESCRIPTOR}` via `selectTool.resize`.
- `demo/main.tsx` (or wherever the demo index lives — verify in step 8) — register the new math-explainer demo.

**Create:**
- `demo/demos/RotatedResizeMathDemo.tsx` — four-panel math explainer with three counterexamples.

**Test:**
- `src/interactions/actions/resize/geometry.test.ts` — extend with `ROTATED_POSE_DESCRIPTOR` cases.
- `src/interactions/actions/resize/cornerHandles.test.ts` — extend with `fixedCornerOf` cases.
- `src/interactions/actions/resize/resize.test.ts` — extend with rotated-resize cases (drag projection, anchor invariance, behaviors-on-local-frame, flipped-pose, group-warning, bit-identical regression).
- `src/interactions/usePointerGestures.test.ts` — extend with rotated-handle hit-test cases.

---

## Task 1: `getRotation?` on `PoseDescriptor`, ship `ROTATED_POSE_DESCRIPTOR`

**Files:**
- Modify: `src/interactions/actions/resize/geometry.ts`
- Test: `src/interactions/actions/resize/geometry.test.ts`

- [ ] **Step 1.1: Write the failing test for `ROTATED_POSE_DESCRIPTOR.getRotation`**

Append to `src/interactions/actions/resize/geometry.test.ts`:

```ts
import { ROTATED_POSE_DESCRIPTOR } from './geometry';
import type { RotatedPose } from '../types';

describe('ROTATED_POSE_DESCRIPTOR', () => {
  const pose: RotatedPose = { x: 5, y: 6, width: 10, height: 20, rotation: Math.PI / 3 };

  it('getRotation reads pose.rotation', () => {
    expect(ROTATED_POSE_DESCRIPTOR.getRotation!(pose)).toBe(Math.PI / 3);
  });

  it('getBounds reads x/y/width/height (rotation ignored)', () => {
    expect(ROTATED_POSE_DESCRIPTOR.getBounds(pose)).toEqual({
      x: 5, y: 6, width: 10, height: 20,
    });
  });

  it('remapBounds preserves rotation field across rect→rect remap', () => {
    const src = { x: 5, y: 6, width: 10, height: 20 };
    const dst = { x: 0, y: 0, width: 20, height: 40 };
    const out = ROTATED_POSE_DESCRIPTOR.remapBounds(pose, src, dst);
    expect(out.rotation).toBe(Math.PI / 3);
    expect(out.x).toBe(0);
    expect(out.width).toBe(20);
  });

  it('translate preserves rotation field', () => {
    const out = ROTATED_POSE_DESCRIPTOR.translate!(pose, 1, 2);
    expect(out.rotation).toBe(Math.PI / 3);
    expect(out.x).toBe(6);
    expect(out.y).toBe(8);
  });
});
```

- [ ] **Step 1.2: Run the test to verify failure**

Run: `npx vitest run src/interactions/actions/resize/geometry.test.ts`
Expected: FAIL — `ROTATED_POSE_DESCRIPTOR` is not exported.

- [ ] **Step 1.3: Add `getRotation?` to `PoseDescriptor` and export `ROTATED_POSE_DESCRIPTOR`**

Edit `src/interactions/actions/resize/geometry.ts`. Add the optional method to the interface and the new descriptor at the bottom:

```ts
import type { ResizePose, RotatedPose } from '../types';

/* ... existing PoseDescriptor with these existing fields: getBounds, remapBounds,
   translate?, intersectsRect?, lerp? ... */
export interface PoseDescriptor<TPose> {
  getBounds(pose: TPose): ResizePose;
  remapBounds(pose: TPose, src: ResizePose, dst: ResizePose): TPose;
  translate?(pose: TPose, dx: number, dy: number): TPose;
  intersectsRect?(pose: TPose, rect: ResizePose): boolean;
  lerp?(a: TPose, b: TPose, t: number): TPose;
  /** Read the pose's rotation in radians. Pivot is the AABB center
   *  (`getBounds(pose)` center). Default 0 when omitted — descriptor
   *  declares "this pose has no rotation." When supplied and non-zero,
   *  `useResize` projects the drag delta into the leaf's local frame,
   *  runs anchor math there, and translates the resulting pose so the
   *  diagonally opposite world-space corner is pinned. */
  getRotation?(pose: TPose): number;
}

/* ... existing aabbIntersectsRect, RECT_POSE_DESCRIPTOR ... */

/** Identity geometry for `RotatedPose`. Inherits rect-shape projection
 *  from `RECT_POSE_DESCRIPTOR` (the `RotatedPose extends ResizePose`
 *  subtype lets the rect descriptor's methods apply directly; `remapBounds`
 *  preserves the `rotation` field via `...p` spread). Adds `getRotation` so
 *  `useResize` knows to take the rotation-aware math path. */
export const ROTATED_POSE_DESCRIPTOR: PoseDescriptor<RotatedPose> = {
  getBounds: RECT_POSE_DESCRIPTOR.getBounds as PoseDescriptor<RotatedPose>['getBounds'],
  remapBounds: RECT_POSE_DESCRIPTOR.remapBounds as PoseDescriptor<RotatedPose>['remapBounds'],
  translate: RECT_POSE_DESCRIPTOR.translate as PoseDescriptor<RotatedPose>['translate'],
  intersectsRect: RECT_POSE_DESCRIPTOR.intersectsRect as PoseDescriptor<RotatedPose>['intersectsRect'],
  lerp: RECT_POSE_DESCRIPTOR.lerp as PoseDescriptor<RotatedPose>['lerp'],
  getRotation: (p) => p.rotation,
};
```

The casts are needed because `RECT_POSE_DESCRIPTOR` is typed for `PoseDescriptor<ResizePose>` and the methods spread `...p` so they return `ResizePose`, not `RotatedPose`. The casts are sound: the runtime `...p` spread preserves all extra fields including `rotation`.

- [ ] **Step 1.4: Re-export from the resize index and barrel**

Edit `src/interactions/actions/resize/index.ts`:

```ts
export { RECT_POSE_DESCRIPTOR, ROTATED_POSE_DESCRIPTOR, type PoseDescriptor } from './geometry';
```

Edit `src/index.ts` near the existing `RECT_POSE_DESCRIPTOR` export (currently around line 336):

```ts
export {
  RECT_POSE_DESCRIPTOR,
  ROTATED_POSE_DESCRIPTOR,
} from './interactions/actions/resize/geometry';
```

- [ ] **Step 1.5: Run the test to verify it passes**

Run: `npx vitest run src/interactions/actions/resize/geometry.test.ts`
Expected: PASS — all four new cases.

- [ ] **Step 1.6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean — no diagnostics.

- [ ] **Step 1.7: Commit**

```bash
git add src/interactions/actions/resize/geometry.ts \
        src/interactions/actions/resize/geometry.test.ts \
        src/interactions/actions/resize/index.ts \
        src/index.ts
git commit -m "feat(resize): PoseDescriptor.getRotation + ROTATED_POSE_DESCRIPTOR"
```

---

## Task 2: `fixedCornerOf` helper

**Files:**
- Modify: `src/interactions/actions/resize/cornerHandles.ts`
- Test: `src/interactions/actions/resize/cornerHandles.test.ts`

- [ ] **Step 2.1: Write the failing test**

Append to `src/interactions/actions/resize/cornerHandles.test.ts`:

```ts
import { fixedCornerOf } from './cornerHandles';

describe('fixedCornerOf', () => {
  const b = { x: 10, y: 20, width: 30, height: 40 };

  it('anchor min/min (drag bottom-right): fixed corner is top-left', () => {
    expect(fixedCornerOf(b, { x: 'min', y: 'min' })).toEqual({ x: 40, y: 60 });
  });

  it('anchor min/max (drag top-right): fixed corner is bottom-left', () => {
    expect(fixedCornerOf(b, { x: 'min', y: 'max' })).toEqual({ x: 40, y: 20 });
  });

  it('anchor max/min (drag bottom-left): fixed corner is top-right', () => {
    expect(fixedCornerOf(b, { x: 'max', y: 'min' })).toEqual({ x: 10, y: 60 });
  });

  it('anchor max/max (drag top-left): fixed corner is bottom-right', () => {
    expect(fixedCornerOf(b, { x: 'max', y: 'max' })).toEqual({ x: 10, y: 20 });
  });

  it('anchor free axis: fixed coord is the bounds origin on that axis', () => {
    expect(fixedCornerOf(b, { x: 'free', y: 'min' })).toEqual({ x: 10, y: 60 });
  });
});
```

Note on the convention: `cornerResizeHandles` produces handles whose `anchor` records *which axis edges move*. `anchor.x === 'min'` means the min-x edge moves under the drag (so the max-x corner is fixed); `anchor.y === 'min'` means the min-y edge moves (so the max-y corner is fixed). `'free'` means that axis doesn't move at all under this anchor — the fixed coord on that axis is just the bounds origin (matches the convention that `ResizeAnchor` axis values are `'min' | 'max' | 'free'`; `free` is used by edge handles, not corners, but `fixedCornerOf` should still produce a sensible point).

- [ ] **Step 2.2: Run the test to verify failure**

Run: `npx vitest run src/interactions/actions/resize/cornerHandles.test.ts`
Expected: FAIL — `fixedCornerOf` is not exported.

- [ ] **Step 2.3: Implement `fixedCornerOf`**

Append to `src/interactions/actions/resize/cornerHandles.ts`:

```ts
import type { ResizeAnchor } from '../types';

/** The corner that does NOT move under a resize gesture with the given
 *  anchor. Used by the rotated-resize math to pin a world-space invariant.
 *
 *  Convention: `anchor.x === 'min'` means the min-x edge moves, so the
 *  fixed corner sits at `x = bounds.x + bounds.width` (max-x). `'free'` on
 *  an axis means that axis doesn't move; the fixed coord is the bounds
 *  origin on that axis. */
export function fixedCornerOf(
  bounds: Bounds,
  anchor: ResizeAnchor,
): { x: number; y: number } {
  return {
    x: anchor.x === 'min' ? bounds.x + bounds.width : bounds.x,
    y: anchor.y === 'min' ? bounds.y + bounds.height : bounds.y,
  };
}
```

(`Bounds` is the local interface already declared at the top of the file.)

- [ ] **Step 2.4: Re-export from `src/interactions/actions/resize/index.ts`**

Edit `src/interactions/actions/resize/index.ts`:

```ts
export {
  cornerResizeHandles,
  hitCornerHandle,
  fixedCornerOf,
  type CornerHandle,
} from './cornerHandles';
```

- [ ] **Step 2.5: Run the test to verify it passes**

Run: `npx vitest run src/interactions/actions/resize/cornerHandles.test.ts`
Expected: PASS — five cases.

- [ ] **Step 2.6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2.7: Commit**

```bash
git add src/interactions/actions/resize/cornerHandles.ts \
        src/interactions/actions/resize/cornerHandles.test.ts \
        src/interactions/actions/resize/index.ts
git commit -m "feat(resize): fixedCornerOf helper for rotated-resize math"
```

---

## Task 3: Rotated-resize math in `useResize`

**Files:**
- Modify: `src/interactions/actions/resize/resize.ts`
- Test: `src/interactions/actions/resize/resize.test.ts`

This is the big task. We TDD it in stages: regression first (existing tests still pass), then anchor invariance, then drag projection, then behaviors-on-local-frame, then flipped pose, then the group warning.

- [ ] **Step 3.1: Write the failing test for anchor invariance (the load-bearing invariant)**

Append a new `describe` block to `src/interactions/actions/resize/resize.test.ts`:

```ts
import { ROTATED_POSE_DESCRIPTOR } from './geometry';
import type { RotatedPose } from '../types';
import { rotatePoint } from '../rotate/geometry';

interface RP extends RotatedPose {}

function makeRotatedAdapter(initial: Array<[string, RP]>) {
  const state = new Map<string, RP>(initial.map(([k, v]) => [k, { ...v }]));
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: ResizeAdapter<{ id: string }, RP> = {
    getNode: (id) => (state.has(id) ? { id } : undefined),
    getPose: (id) => ({ ...(state.get(id)!) }),
    setPose: (id, pose) => state.set(id, { ...pose }),
    applyBatch: (ops, label) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, batches, state };
}

function fixedCornerWorld(pose: RP, anchor: { x: 'min' | 'max'; y: 'min' | 'max' }): { x: number; y: number } {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  const localX = anchor.x === 'min' ? pose.x + pose.width : pose.x;
  const localY = anchor.y === 'min' ? pose.y + pose.height : pose.y;
  return rotatePoint(localX, localY, cx, cy, pose.rotation);
}

describe('useResize — rotated leaf: anchor invariance', () => {
  const angles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 2, -Math.PI / 4, Math.PI];
  const anchors: Array<{ x: 'min' | 'max'; y: 'min' | 'max' }> = [
    { x: 'min', y: 'min' }, // drag BR; fix TL
    { x: 'min', y: 'max' }, // drag TR; fix BL
    { x: 'max', y: 'min' }, // drag BL; fix TR
    { x: 'max', y: 'max' }, // drag TL; fix BR
  ];

  for (const angle of angles) {
    for (const anchor of anchors) {
      it(`pins the fixed corner in world space (θ=${angle.toFixed(3)}, anchor=${anchor.x}/${anchor.y})`, () => {
        const origin: RP = { x: 0, y: 0, width: 100, height: 60, rotation: angle };
        const { adapter, state } = makeRotatedAdapter([['a', origin]]);
        const { result } = renderHook(() =>
          useResize<{ id: string }, RP>(adapter, { geometry: ROTATED_POSE_DESCRIPTOR }),
        );

        const fixedAtStart = fixedCornerWorld(origin, anchor);

        act(() => {
          result.current.start('a', anchor, 50, 30);
        });
        act(() => {
          result.current.move(80, 50, { alt: false, shift: false, meta: false, ctrl: false });
        });
        act(() => {
          result.current.end();
        });

        const final = state.get('a')!;
        const fixedAtEnd = fixedCornerWorld(final, anchor);
        expect(fixedAtEnd.x).toBeCloseTo(fixedAtStart.x, 5);
        expect(fixedAtEnd.y).toBeCloseTo(fixedAtStart.y, 5);
      });
    }
  }
});
```

- [ ] **Step 3.2: Run the test to verify failure**

Run: `npx vitest run src/interactions/actions/resize/resize.test.ts -t "anchor invariance"`
Expected: FAIL — for non-zero angles, the fixed corner drifts because the hook applies world-frame anchor math without rotation projection.

- [ ] **Step 3.3: Implement the rotated-resize math branch in `useResize`**

Edit `src/interactions/actions/resize/resize.ts`. Three changes:

(a) Add imports near the top:

```ts
import { rotatePoint } from '../rotate/geometry';
import { fixedCornerOf } from './cornerHandles';
```

(b) Extend `State<TPose>` (the `interface State` block) with rotation fields:

```ts
interface State<TPose> {
  // ... existing fields ...
  /** Rotation captured at gesture start. 0 means unrotated short-circuit. */
  originRotation: number;
  /** World-space position of the diagonally opposite corner at start. */
  fixedWorld: { x: number; y: number };
  /** Set true if any leaf in the group expansion has rotation != 0;
   *  fires the dev warning once at start. */
  groupHasRotated: boolean;
}
```

Update the `useRef<State<TPose>>` initializer to include the new fields with defaults `0`, `{ x: 0, y: 0 }`, `false`.

Update `cleanup()` to reset them similarly (set `originRotation: 0`, `fixedWorld: { x: 0, y: 0 }`, `groupHasRotated: false`).

(c) In `start()` (after `originBounds` is computed but before `setOverlay`), capture rotation and the world-space fixed corner; emit the dev warning if any group leaf is rotated:

```ts
const originRotation = geom.getRotation?.(originPose) ?? 0;
const fixedLocal = fixedCornerOf(originBounds, anchor);
const fixedWorld = originRotation === 0
  ? fixedLocal
  : rotatePoint(
      fixedLocal.x, fixedLocal.y,
      originBounds.x + originBounds.width / 2,
      originBounds.y + originBounds.height / 2,
      originRotation,
    );

let groupHasRotated = false;
if (leafIds && leafOrigins) {
  for (const lid of leafIds) {
    const r = geom.getRotation?.(leafOrigins.get(lid)!) ?? 0;
    if (r !== 0) { groupHasRotated = true; break; }
  }
  if (groupHasRotated && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      'useResize: group resize with rotated leaves is not supported. ' +
      'Falling back to AABB-frame group resize; results will be visually ' +
      'incorrect for rotated leaves.',
    );
  }
}
```

Then write `originRotation`, `fixedWorld`, `groupHasRotated` into `stateRef.current`.

(d) In `move()`, branch on `s.originRotation`:

```ts
let proposedBounds: ResizePose;
if (s.originRotation === 0) {
  // Unrotated path — bit-identical to today.
  let nx = ob.x;
  let ny = ob.y;
  let nw = ob.width;
  let nh = ob.height;
  if (s.anchor.x === 'min') {
    nw = ob.width + dx;
  } else if (s.anchor.x === 'max') {
    nx = ob.x + dx;
    nw = ob.width - dx;
  }
  if (s.anchor.y === 'min') {
    nh = ob.height + dy;
  } else if (s.anchor.y === 'max') {
    ny = ob.y + dy;
    nh = ob.height - dy;
  }
  proposedBounds = { x: nx, y: ny, width: nw, height: nh };
} else {
  // Rotated path: project drag into local frame.
  const cs = Math.cos(-s.originRotation);
  const sn = Math.sin(-s.originRotation);
  const dxLocal = cs * dx - sn * dy;
  const dyLocal = sn * dx + cs * dy;
  let nx = ob.x;
  let ny = ob.y;
  let nw = ob.width;
  let nh = ob.height;
  if (s.anchor.x === 'min') {
    nw = ob.width + dxLocal;
  } else if (s.anchor.x === 'max') {
    nx = ob.x + dxLocal;
    nw = ob.width - dxLocal;
  }
  if (s.anchor.y === 'min') {
    nh = ob.height + dyLocal;
  } else if (s.anchor.y === 'max') {
    ny = ob.y + dyLocal;
    nh = ob.height - dyLocal;
  }
  proposedBounds = { x: nx, y: ny, width: nw, height: nh };
}
```

Behaviors then run on `proposedBounds` exactly as today. After behaviors produce the (possibly-clamped) `proposedBounds`, project back to TPose via `geom.remapBounds` exactly as today. Then position-correct only when rotated:

```ts
let proposedPose = geom.remapBounds(s.originPose, s.originBounds, proposedBounds);

if (s.originRotation !== 0) {
  const newCenterX = proposedBounds.x + proposedBounds.width / 2;
  const newCenterY = proposedBounds.y + proposedBounds.height / 2;
  const newFixedLocal = fixedCornerOf(proposedBounds, s.anchor);
  const newFixedWorld = rotatePoint(
    newFixedLocal.x, newFixedLocal.y,
    newCenterX, newCenterY,
    s.originRotation,
  );
  const correctionX = s.fixedWorld.x - newFixedWorld.x;
  const correctionY = s.fixedWorld.y - newFixedWorld.y;
  const translate = geom.translate ?? ((p, dx, dy) => ({ ...(p as object), x: (p as { x: number }).x + dx, y: (p as { y: number }).y + dy } as TPose));
  proposedPose = translate(proposedPose, correctionX, correctionY);
}
```

(`geom.translate` defaults inline because `RECT_POSE_DESCRIPTOR` and `ROTATED_POSE_DESCRIPTOR` both supply it; the fallback covers the unlikely future case of a custom descriptor without translate.)

Apply the same correction to the lerped `currentPose` so the visible ghost obeys the same invariant. Specifically, after computing `currentBounds` (the lerped local-frame bounds) and `currentPose = geom.remapBounds(s.originPose, s.originBounds, currentBounds)`:

```ts
let currentPose = geom.remapBounds(s.originPose, s.originBounds, currentBounds);
if (s.originRotation !== 0) {
  const newCenterX = currentBounds.x + currentBounds.width / 2;
  const newCenterY = currentBounds.y + currentBounds.height / 2;
  const newFixedLocal = fixedCornerOf(currentBounds, s.anchor);
  const newFixedWorld = rotatePoint(
    newFixedLocal.x, newFixedLocal.y,
    newCenterX, newCenterY,
    s.originRotation,
  );
  const correctionX = s.fixedWorld.x - newFixedWorld.x;
  const correctionY = s.fixedWorld.y - newFixedWorld.y;
  const translate = geom.translate ?? ((p, dx, dy) => ({ ...(p as object), x: (p as { x: number }).x + dx, y: (p as { y: number }).y + dy } as TPose));
  currentPose = translate(currentPose, correctionX, correctionY);
}
```

(The duplicated translate-fallback expression is intentional — there are two call sites; do not extract to a hoisted helper unless step 3.10's review reveals a cleaner shape.)

For the leaf-iteration branch (`s.leafIds && s.leafOrigins`), keep today's behavior unchanged. The dev warning at start signals that the result is wrong-but-survivable for rotated leaves.

`s.ctx.current = new Map([[s.id, proposedPose]]);` is set as today.

Write `setOverlay({ id: s.id, currentPose, targetPose: proposedPose, anchor: s.anchor, leafPoses })` as today.

- [ ] **Step 3.4: Run the anchor-invariance test**

Run: `npx vitest run src/interactions/actions/resize/resize.test.ts -t "anchor invariance"`
Expected: PASS — 24 cases (6 angles × 4 anchors).

- [ ] **Step 3.5: Run the existing resize tests as a regression check**

Run: `npx vitest run src/interactions/actions/resize/resize.test.ts`
Expected: PASS — every existing case still green. The unrotated short-circuit guarantees this.

- [ ] **Step 3.6: Add the drag-projection test**

Append to `resize.test.ts`:

```ts
describe('useResize — rotated leaf: drag projection', () => {
  it('θ=π/2: a drag of (10, 0) world maps to a drag of (0, -10) local (CCW 90°)', () => {
    // Origin pose at (0,0,100,60), rotated 90° CCW about its AABB center.
    // A pointer drag of +10 in world-x corresponds, in the leaf's local frame,
    // to -10 in y (because local axes are rotated 90° from world axes).
    // Anchor min/min (drag bottom-right corner): local-y delta -10 means
    // the bottom edge moves UP by 10, shrinking height to 50.
    const origin: RP = { x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 2 };
    const { adapter } = makeRotatedAdapter([['a', origin]]);
    const { result } = renderHook(() =>
      useResize<{ id: string }, RP>(adapter, { geometry: ROTATED_POSE_DESCRIPTOR }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'min' }, 0, 0);
    });
    act(() => {
      result.current.move(10, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    const ov = result.current.overlay!;
    // Local-frame width should be unchanged (drag had no x-component in local frame).
    expect(ov.targetPose.width).toBeCloseTo(100, 5);
    // Local-frame height should be reduced by 10.
    expect(ov.targetPose.height).toBeCloseTo(50, 5);
  });
});
```

- [ ] **Step 3.7: Run the drag-projection test**

Run: `npx vitest run src/interactions/actions/resize/resize.test.ts -t "drag projection"`
Expected: PASS.

- [ ] **Step 3.8: Add the behaviors-on-local-frame test**

Append to `resize.test.ts`:

```ts
import { lockAspectWithModifier } from './behaviors/lockAspect';

describe('useResize — rotated leaf: behaviors operate on local-frame bounds', () => {
  it('lockAspectWithModifier preserves local-frame width/height ratio under rotation', () => {
    const origin: RP = { x: 0, y: 0, width: 100, height: 50, rotation: Math.PI / 4 };
    const ratio = 100 / 50; // 2:1 in local frame.
    const { adapter } = makeRotatedAdapter([['a', origin]]);
    const { result } = renderHook(() =>
      useResize<{ id: string }, RP>(adapter, {
        geometry: ROTATED_POSE_DESCRIPTOR,
        behaviors: [lockAspectWithModifier<RP>({ key: 'shift' })],
      }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'min' }, 0, 0);
    });
    // Drag with shift; modifier locks aspect ratio.
    act(() => {
      result.current.move(40, 40, { alt: false, shift: true, meta: false, ctrl: false });
    });
    const ov = result.current.overlay!;
    expect(ov.targetPose.width / ov.targetPose.height).toBeCloseTo(ratio, 4);
  });
});
```

- [ ] **Step 3.9: Run the behaviors test**

Run: `npx vitest run src/interactions/actions/resize/resize.test.ts -t "local-frame bounds"`
Expected: PASS.

- [ ] **Step 3.10: Add the flipped-pose test**

Append:

```ts
describe('useResize — rotated leaf: flipped pose preserved', () => {
  it('drag past fixed corner produces negative width; rotation preserved', () => {
    const origin: RP = { x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 6 };
    const { adapter, state } = makeRotatedAdapter([['a', origin]]);
    const { result } = renderHook(() =>
      useResize<{ id: string }, RP>(adapter, { geometry: ROTATED_POSE_DESCRIPTOR }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'min' }, 0, 0);
    });
    // Big negative-x drag (in world): projected into local frame, width should
    // go negative.
    act(() => {
      result.current.move(-300, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });
    const final = state.get('a')!;
    expect(final.width).toBeLessThan(0);
    expect(final.rotation).toBeCloseTo(Math.PI / 6, 5);
  });
});
```

- [ ] **Step 3.11: Run the flipped-pose test**

Run: `npx vitest run src/interactions/actions/resize/resize.test.ts -t "flipped pose"`
Expected: PASS.

- [ ] **Step 3.12: Add the group-with-rotated-leaves warning test**

Append:

```ts
describe('useResize — group resize with rotated leaves emits a dev warning', () => {
  it('warns once at start when any leaf has rotation != 0', () => {
    const origin: RP = { x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 6 };
    const { adapter } = makeRotatedAdapter([['a', origin], ['b', { ...origin, x: 200 }]]);
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args) => { warnings.push(args.join(' ')); };
    try {
      const { result } = renderHook(() =>
        useResize<{ id: string }, RP>(adapter, {
          geometry: ROTATED_POSE_DESCRIPTOR,
          expandIds: () => ['a', 'b'],
        }),
      );
      act(() => {
        result.current.start('group', { x: 'min', y: 'min' }, 0, 0);
      });
      // Move a few times — warning should fire only once at start.
      act(() => {
        result.current.move(10, 10, { alt: false, shift: false, meta: false, ctrl: false });
      });
      act(() => {
        result.current.move(20, 20, { alt: false, shift: false, meta: false, ctrl: false });
      });
    } finally {
      console.warn = origWarn;
    }
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/group resize with rotated leaves is not supported/);
  });
});
```

(Vitest's `import.meta.env.DEV` is true by default in test runs; verify if not, set explicitly in the test setup.)

- [ ] **Step 3.13: Run the warning test**

Run: `npx vitest run src/interactions/actions/resize/resize.test.ts -t "group resize with rotated leaves"`
Expected: PASS.

- [ ] **Step 3.14: Run the full resize test suite**

Run: `npx vitest run src/interactions/actions/resize/`
Expected: PASS — every case green, including all the existing unrotated cases.

- [ ] **Step 3.15: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3.16: Commit**

```bash
git add src/interactions/actions/resize/resize.ts \
        src/interactions/actions/resize/resize.test.ts
git commit -m "feat(resize): rotated-resize math (drag projection + anchor pinning)"
```

---

## Task 4: Hit-test integration in `usePointerGestures`

**Files:**
- Modify: `src/interactions/usePointerGestures.ts`
- Test: `src/interactions/usePointerGestures.test.ts`

- [ ] **Step 4.1: Write the failing test for rotated-handle hit**

Append to `src/interactions/usePointerGestures.test.ts`:

```ts
import { rotatePoint } from './gestures/rotate/geometry';

describe('usePointerGestures — rotated resize handle hit-test', () => {
  it('hits the rotated-corner position, not the unrotated AABB corner', () => {
    // Setup: 100×60 rect at (0,0), rotated π/4. The unrotated bottom-right
    // corner is at (100, 60); the rotated bottom-right corner sits at the
    // image of (100, 60) under R(π/4) about center (50, 30).
    const bounds = { x: 0, y: 0, width: 100, height: 60 };
    const center = { x: 50, y: 30 };
    const rotation = Math.PI / 4;
    const rotatedBR = rotatePoint(100, 60, center.x, center.y, rotation);

    const resize = { start: vi.fn(), move: vi.fn(), end: vi.fn(), cancel: vi.fn(), isResizing: false, overlay: null, adapter: {} as never };

    const { container } = render(
      <Harness
        // ... existing test harness pattern that wires usePointerGestures ...
        resize={resize}
        resizeTarget={() => ({ id: 'a', bounds, rotation })}
        clientToWorld={(_, cx, cy) => [cx, cy]}
        handleHitRadius={8}
      />,
    );
    const canvas = container.querySelector('canvas')!;

    // Click at the rotated-corner world position.
    fireEvent.pointerDown(canvas, { clientX: rotatedBR.x, clientY: rotatedBR.y });
    expect(resize.start).toHaveBeenCalledTimes(1);
    expect(resize.start.mock.calls[0]).toEqual(['a', { x: 'min', y: 'min' }, rotatedBR.x, rotatedBR.y]);

    resize.start.mockClear();

    // Click at the unrotated-AABB BR corner (100, 60). Should NOT fire resize.start.
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 60 });
    expect(resize.start).not.toHaveBeenCalled();
  });
});
```

(Use the existing test patterns from `usePointerGestures.test.ts` — look at the existing resize hit-test cases around line 268 for the harness shape; mirror them for the rotated case.)

- [ ] **Step 4.2: Run the test to verify failure**

Run: `npx vitest run src/interactions/usePointerGestures.test.ts -t "rotated resize handle"`
Expected: FAIL — current hit-test doesn't rotate handle positions.

- [ ] **Step 4.3: Update `resizeTarget` return type**

Edit `src/interactions/usePointerGestures.ts`. Around line 94:

```ts
resizeTarget?: () => { id: string; bounds: Bounds; rotation?: number } | null;
```

Around line 178, update the synthesized `resizeTarget` to read rotation from `boundsOf`'s return (mirror lines 190–204's `rotateTarget` synthesis):

```ts
const resizeTarget = useCallback(
  (): { id: string; bounds: Bounds; rotation?: number } | null => {
    if (explicitResizeTarget) return explicitResizeTarget();
    if (selection && boundsOf) {
      const ids = selection.get();
      if (ids.length !== 1) return null;
      const b = boundsOf(ids[0]);
      if (!b) return null;
      const rotation = (b as Bounds & { rotation?: number }).rotation;
      return { id: ids[0], bounds: b, rotation };
    }
    return null;
  },
  [explicitResizeTarget, selection, boundsOf],
);
```

- [ ] **Step 4.4: Branch the hit-test on rotation**

Edit the resize hit-test block (around lines 266–278). Add an import for `rotatePoint` near the top of the file:

```ts
import { rotatePoint } from './gestures/rotate/geometry';
```

Then update the hit-test:

```ts
if (resize) {
  const target = resizeTarget();
  if (target) {
    const rot = target.rotation ?? 0;
    const cx = target.bounds.x + target.bounds.width / 2;
    const cy = target.bounds.y + target.bounds.height / 2;
    for (const h of cornerResizeHandles(target.bounds)) {
      const center = rot === 0
        ? { x: h.cx, y: h.cy }
        : rotatePoint(h.cx, h.cy, cx, cy, rot);
      const rotatedHandle = { cx: center.x, cy: center.y, anchor: h.anchor };
      if (hitCornerHandle(rotatedHandle, wx, wy, radiusWorld)) {
        dragKindRef.current = 'resize';
        e.currentTarget.setPointerCapture(e.pointerId);
        attachDocListeners();
        resize.start(target.id, h.anchor, wx, wy);
        return;
      }
    }
  }
}
```

- [ ] **Step 4.5: Run the rotated hit-test test**

Run: `npx vitest run src/interactions/usePointerGestures.test.ts -t "rotated resize handle"`
Expected: PASS.

- [ ] **Step 4.6: Run the full pointer-gestures test suite as regression check**

Run: `npx vitest run src/interactions/usePointerGestures.test.ts`
Expected: PASS — every existing case green; the unrotated branch is a no-op pass-through.

- [ ] **Step 4.7: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4.8: Commit**

```bash
git add src/interactions/usePointerGestures.ts \
        src/interactions/usePointerGestures.test.ts
git commit -m "feat(pointer-gestures): rotated resize handle hit-test"
```

---

## Task 5: `Canvas.tsx` synthesizes rotation in `boundsOf`

**Files:**
- Modify: `src/canvas/Canvas.tsx`
- Test: `src/canvas/Canvas.test.tsx` (extend existing resize hit-test case)

- [ ] **Step 5.1: Write the failing integration test**

Append to `src/canvas/Canvas.test.tsx` (mirror the existing `'useSelectTool boundsOf drives resize handle hit-test'` case around line 271):

```ts
import { ROTATED_POSE_DESCRIPTOR } from '../interactions/actions/resize/geometry';

it('synthesized boundsOf folds rotation from descriptor.getRotation', () => {
  // 100×60 rotated rect; the synthesized boundsOf should return
  // { x, y, width, height, rotation }.
  const item = { id: 'a', x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 4 };
  const seen: Array<unknown> = [];

  function Probe() {
    // Borrow the canvas to read its synthesized boundsOf at mount time.
    return null;
  }

  // Use Canvas with `geometry={ROTATED_POSE_DESCRIPTOR}` and an adapter that
  // returns the rotated pose. Capture the `boundsOf` result for id 'a'.
  // (Reuse the existing test harness pattern; see resize-hit-test case for shape.)
  // ... harness boilerplate ...

  // The expectation:
  expect((seen[0] as { rotation: number }).rotation).toBeCloseTo(Math.PI / 4, 5);
});
```

If extending the existing harness is more work than the value of this test, replace it with a simpler unit test that constructs the `baseBoundsOf` factory directly. Pragmatically: the production code change is one line, and Task 4's hit-test test already covers the wiring end-to-end via the explicit-resizeTarget path; the value here is verifying the synthesis path. Use whichever shape lands cleanly.

- [ ] **Step 5.2: Run the test to verify failure**

Run: `npx vitest run src/canvas/Canvas.test.tsx -t "rotation from descriptor"`
Expected: FAIL — current `baseBoundsOf` returns plain bounds without rotation.

- [ ] **Step 5.3: Update `baseBoundsOf` to fold rotation**

Edit `src/canvas/Canvas.tsx` lines 738–748:

```ts
const baseBoundsOf = useMemo(() => {
  if (boundsOf) return boundsOf;
  if (!adapter) return undefined;
  return (id: string): Bounds | null => {
    try {
      const pose = adapter.getPose(id);
      const b = geometry.getBounds(pose);
      const rot = geometry.getRotation?.(pose);
      return rot ? { ...b, rotation: rot } : b;
    } catch {
      return null;
    }
  };
}, [boundsOf, adapter, geometry]);
```

Also widen the local `Bounds` interface at line 60 to allow the optional rotation pass-through:

```ts
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}
```

(`Canvas`'s downstream consumers — selection overlay, pointer gestures — already accept `Bounds & { rotation?: number }` shapes per Task 4 and per the overlay's existing `rotationOf(b)` helper.)

Mirror the `Bounds` widening in `src/interactions/usePointerGestures.ts` line 21:

```ts
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}
```

(`usePointerGestures.ts`'s `boundsOf?: (id: string) => Bounds | null` callback already needs to surface rotation — adding the optional field aligns the local type with the precedent in `selection/overlay.ts`.)

- [ ] **Step 5.4: Run the failing test**

Run: `npx vitest run src/canvas/Canvas.test.tsx -t "rotation from descriptor"`
Expected: PASS.

- [ ] **Step 5.5: Run the full Canvas + pointer-gestures + resize test suites as regression check**

Run: `npx vitest run src/canvas/ src/interactions/`
Expected: PASS — every case green.

- [ ] **Step 5.6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5.7: Commit**

```bash
git add src/canvas/Canvas.tsx \
        src/canvas/Canvas.test.tsx \
        src/interactions/usePointerGestures.ts
git commit -m "feat(canvas): synthesized boundsOf surfaces rotation via descriptor.getRotation"
```

---

## Task 6: `RotateDemo` opts in to rotated resize

**Files:**
- Modify: `demo/demos/RotateDemo.tsx`

- [ ] **Step 6.1: Add resize opt-in**

Edit `demo/demos/RotateDemo.tsx`. Update the `<SceneCanvas>` props:

```tsx
import { ROTATED_POSE_DESCRIPTOR } from '@orochi235/weasel';

// ...

<SceneCanvas
  backend={backend}
  width={W}
  height={H}
  className="ckd-canvas"
  scene={scene}
  selectTool={{
    handleHitRadius: HANDLE,
    resize: { geometry: ROTATED_POSE_DESCRIPTOR },
  }}
  geometry={{ pickEvery }}
  selectionOptions={{ initial: ['b'] }}
  layers={{
    scene: { /* ... unchanged ... */ },
    selectionOverlay: { handles: { size: HANDLE }, rotationHandle: true },
  }}
/>
```

Update `ROTATE_DEMO_SOURCE` to mirror the change so the on-page source listing matches.

- [ ] **Step 6.2: Run the dev server and smoke-test manually**

Run: `npm run dev`

Open the RotateDemo page in a browser. Verify:

1. Click rect `b` (the 30°-rotated one). Selection overlay shows handles at the rotated body's corners.
2. Click and drag a visible corner handle. The leaf resizes in its own local frame; the diagonally opposite corner stays pinned in world space.
3. Repeat for all four corners on a single rect.
4. Repeat for rect `c` (the −45°-rotated one).
5. After resizing, drag the rotation handle. Rotation pivots around the new AABB center; no visible jump or drift.
6. Click rect `a` (rotation 0). Drag a corner. Behavior identical to today's resize on an unrotated rect.

If any step shows visible drift, anchor jumps, or distortion, return to Task 3 — the math has a bug.

- [ ] **Step 6.3: Run typecheck and unit tests as final regression check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: both clean.

- [ ] **Step 6.4: Commit**

```bash
git add demo/demos/RotateDemo.tsx
git commit -m "demo(rotate): opt in to ROTATED_POSE_DESCRIPTOR for rotated resize"
```

---

## Task 7: Math explainer demo — file scaffold + index registration

**Files:**
- Create: `demo/demos/RotatedResizeMathDemo.tsx`
- Modify: demo index (look up exact location in step 7.1; commonly `demo/main.tsx`, `demo/demos/index.tsx`, or a sidebar config — verify in step 7.1)

- [ ] **Step 7.1: Locate the demo index**

Run: `grep -rn "RotateDemo" demo/ | head`

The output identifies the file that imports + registers existing demos. Open it and confirm the registration shape (typically an array of `{ name, component }` or similar). Note the exact file path for step 7.5.

- [ ] **Step 7.2: Create the demo file scaffold**

Create `demo/demos/RotatedResizeMathDemo.tsx`:

```tsx
import {
  SceneCanvas,
  pointInRotatedRect,
  ROTATED_POSE_DESCRIPTOR,
  useScene,
} from '@orochi235/weasel';
import type { RotatedPose } from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';
import { useState } from 'react';
import { useBackend } from '../BackendContext';

interface Rect extends RotatedPose {
  id: string;
  color: string;
}

const W = 320, H = 240, HANDLE = 8;

function INITIAL_RECT(color: string): Rect[] {
  return [{ id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color }];
}

function drawRect(cx: CanvasRenderingContext2D, p: Rect): void {
  const cxw = p.x + p.width / 2;
  const cyw = p.y + p.height / 2;
  cx.save();
  cx.translate(cxw, cyw);
  cx.rotate(p.rotation);
  cx.translate(-cxw, -cyw);
  cx.fillStyle = p.color;
  cx.fillRect(p.x, p.y, p.width, p.height);
  cx.restore();
}

function drawRectGL(_node: unknown, p: Rect): DrawCommand[] {
  const cxw = p.x + p.width / 2;
  const cyw = p.y + p.height / 2;
  const cs = Math.cos(p.rotation);
  const sn = Math.sin(p.rotation);
  const a = cs, b = sn, c = -sn, d = cs;
  const tx = cxw - a * cxw - c * cyw;
  const ty = cyw - b * cxw - d * cyw;
  const transform = new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
  return [{
    kind: 'group',
    transform,
    children: [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      fill: { color: p.color },
    }],
  }];
}

function pickEveryFor(scene: ReturnType<typeof useScene<Rect>>) {
  return (wx: number, wy: number): string | null => {
    const ordered = [...scene.renderOrder()];
    for (let i = ordered.length - 1; i >= 0; i--) {
      const n = scene.get(ordered[i]);
      if (n && pointInRotatedRect(n.pose, wx, wy)) return n.id;
    }
    return null;
  };
}

/** Panel 1 — the full math (correct). */
function FullMathPanel() {
  const backend = useBackend();
  const scene = useScene({ items: INITIAL_RECT('#7fb069') });
  return (
    <SceneCanvas
      backend={backend}
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectTool={{
        handleHitRadius: HANDLE,
        resize: { geometry: ROTATED_POSE_DESCRIPTOR },
      }}
      geometry={{ pickEvery: pickEveryFor(scene) }}
      selectionOptions={{ initial: ['a'] }}
      layers={{
        scene: { drawOne: (cx, _n, p) => drawRect(cx, p), drawOneGL: drawRectGL },
        selectionOverlay: { handles: { size: HANDLE }, rotationHandle: false },
      }}
    />
  );
}

export function RotatedResizeMathDemo() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <FullMathPanel />
      {/* Counterexample panels added in steps 7.3–7.5 */}
    </div>
  );
}

export const ROTATED_RESIZE_MATH_DEMO_SOURCE = `// Math explainer — see RotatedResizeMathDemo.tsx`;
```

- [ ] **Step 7.3: Smoke-test the scaffold in the browser**

Run: `npm run dev`. Verify the FullMathPanel renders a single rotated rect with selection handles and rotated-resize works (this exercises the same code path as Task 6's RotateDemo, just in a smaller demo).

- [ ] **Step 7.4: Add the demo to the index**

Edit the demo index file located in step 7.1. Add an entry registering `RotatedResizeMathDemo` alongside `RotateDemo`. Use the index's existing pattern verbatim — do not invent a new shape.

- [ ] **Step 7.5: Commit the scaffold**

```bash
git add demo/demos/RotatedResizeMathDemo.tsx <demo-index-path>
git commit -m "demo(rotated-resize): math explainer scaffold (full-math panel)"
```

---

## Task 8: Math explainer demo — counterexample panels and live ledger

**Files:**
- Modify: `demo/demos/RotatedResizeMathDemo.tsx`

The three counterexamples each construct a *custom* `PoseDescriptor` that intentionally skips one step of the math. The `ROTATED_POSE_DESCRIPTOR` already drives the correct panel; for the counterexamples we wire descriptors that subvert it deliberately.

- [ ] **Step 8.1: Add Counterexample 1 — no projection (drag delta in world frame)**

`useResize`'s rotation-aware path is gated entirely on `descriptor.getRotation?.(pose) ?? 0`. To produce the "no projection" failure mode, supply a descriptor whose `getRotation` returns 0 even though the pose has rotation set: this drives the unrotated-path math, which applies the world-frame drag delta to the AABB without projecting through `R(−θ)`. Result: the leaf stretches along world axes; the rotated body distorts.

Add to `RotatedResizeMathDemo.tsx`:

```tsx
import { RECT_POSE_DESCRIPTOR } from '@orochi235/weasel';

/** Subverted descriptor: pose carries rotation, but `getRotation` lies and
 *  returns 0. `useResize` takes the unrotated path; drag delta is applied
 *  without `R(−θ)` projection. Visible failure: leaf distorts as world-axis
 *  scale fights the rotation. */
const NO_PROJECTION_DESCRIPTOR = {
  ...RECT_POSE_DESCRIPTOR,
  getRotation: () => 0,
} as typeof ROTATED_POSE_DESCRIPTOR;

function NoProjectionPanel() {
  const backend = useBackend();
  const scene = useScene({ items: INITIAL_RECT('#d4a574') });
  return (
    <SceneCanvas
      backend={backend}
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectTool={{
        handleHitRadius: HANDLE,
        resize: { geometry: NO_PROJECTION_DESCRIPTOR },
      }}
      geometry={{ pickEvery: pickEveryFor(scene) }}
      selectionOptions={{ initial: ['a'] }}
      layers={{
        scene: { drawOne: (cx, _n, p) => drawRect(cx, p), drawOneGL: drawRectGL },
        selectionOverlay: { handles: { size: HANDLE }, rotationHandle: false },
      }}
    />
  );
}
```

Add `<NoProjectionPanel />` next to `<FullMathPanel />` in the grid.

- [ ] **Step 8.2: Add Counterexample 2 — no position correction**

The position-correction step lives inside `useResize`'s rotated branch, gated on `descriptor.getRotation` being non-zero. To skip *only* the position correction (keeping projection on), the cleanest way is to expose a development-mode flag on the rotated descriptor. We do not want to permanently widen `PoseDescriptor` for a demo concern; instead, build this counterexample by branching the demo's descriptor through a *post-hoc* override that re-runs the resize math without translate. The pragmatic approach for the demo: re-implement a minimal `useResize` substitute inside the panel that does projection but not correction.

This is more code than the other panels but is genuinely educational. Implementation sketch:

```tsx
function NoCorrectionPanel() {
  // Implement a hand-rolled SceneCanvas + custom resize gesture that:
  //  1. Reads pose.rotation at start (projection: ON)
  //  2. Projects drag delta into local frame (projection: ON)
  //  3. Runs anchor math on local-frame bounds (projection: ON)
  //  4. Writes the resulting pose WITHOUT translating to preserve fixedWorld
  //
  // The simplest implementation: wire a custom SceneCanvas with no `selectTool`
  // (the consumer owns gesture handling), use `useResize` directly with a
  // descriptor that has `getRotation` set, and post-process the committed pose
  // to undo the position correction by re-translating back to the AABB-anchored
  // result.
  //
  // Concretely: build a `BAD_TRANSLATE_DESCRIPTOR` whose `translate` is a no-op:
  return (
    <SceneCanvas
      // ... wired exactly like FullMathPanel except:
      selectTool={{
        handleHitRadius: HANDLE,
        resize: {
          geometry: {
            ...ROTATED_POSE_DESCRIPTOR,
            translate: (p) => p,  // no-op: skip the position correction
          } as typeof ROTATED_POSE_DESCRIPTOR,
        },
      }}
    />
  );
}
```

The `translate: (p) => p` no-op deactivates the position correction — `useResize`'s rotated branch still computes the correction delta but the descriptor's translate refuses to apply it. Result: drag a corner; the leaf scales correctly in local frame, but the AABB center stays anchored, so the user-perceived "fixed corner" drifts.

Add `<NoCorrectionPanel />` in the third grid slot.

- [ ] **Step 8.3: Add Counterexample 3 — no anchor invariant (rotation-pivot drifts)**

This counterexample shows what happens when the math respects local-frame projection AND keeps a fixed corner pinned, but the rotation pivot is recomputed each frame from the *new* AABB center. In the kit's actual implementation the pivot is fixed at start time and never recomputed during a resize (only `useRotate` cares about pivot); but it's still illuminating to see what would happen if the rotation were re-applied around the post-resize center while position-correcting against the post-resize fixed corner.

The cleanest demo is a custom-descriptor approach where `getRotation` returns a *different* value than `pose.rotation` — specifically, returns the rotation but the pose's effective rotation pivot drifts. This is hard to construct cleanly via descriptor overrides; the more honest implementation is to compute a "what if" overlay: render a phantom rect alongside the live one showing where it would be if rotation were re-pivoted each frame.

For v1 of the demo, simplify: drop counterexample 3 and ship the demo with two counterexamples (no-projection, no-correction) which together explain the two main math gates. Mark counterexample 3 as a follow-up TODO inside the demo file:

```tsx
// TODO(rotated-resize): add a third counterexample that demonstrates
// rotation-pivot drift (re-applying rotation around the post-resize AABB
// center each frame). Requires a custom gesture controller; defer to a
// follow-up demo iteration.
```

- [ ] **Step 8.4: Add the live anchor-invariant ledger**

Below each panel, render a small monospace caption that shows the anchor invariant. The ledger reads the live pose from each panel's scene and computes:

- `originAnchorWorld` — captured once at gesture start (via `useState` + the panel's scene).
- `currentAnchorWorld` — recomputed each frame from the live pose using `rotatePoint`.
- `delta` — `currentAnchorWorld - originAnchorWorld`.

Implementation:

```tsx
import { rotatePoint } from '@orochi235/weasel/internal/rotate'; // verify the import path during impl

function LedgerCaption({ scene, anchor }: { scene: ReturnType<typeof useScene<Rect>>; anchor: { x: 'min' | 'max'; y: 'min' | 'max' } }) {
  const node = scene.get('a');
  if (!node) return null;
  const p = node.pose;
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  const localX = anchor.x === 'min' ? p.x + p.width : p.x;
  const localY = anchor.y === 'min' ? p.y + p.height : p.y;
  const w = rotatePoint(localX, localY, cx, cy, p.rotation);
  return (
    <pre style={{ fontSize: 11, margin: 0 }}>
      anchor world: ({w.x.toFixed(1)}, {w.y.toFixed(1)})
    </pre>
  );
}
```

Render `<LedgerCaption ... />` immediately below each panel's `<SceneCanvas>`. (The `anchor` prop is hardcoded per-panel to whichever corner the demo expects the user to drag; document this in the demo's README/header text.)

If `rotatePoint` is not exported from the package barrel, either:
- Add it to the barrel as a small utility export, or
- Inline a copy of the 5-line function inside `RotatedResizeMathDemo.tsx`.

Inline is fine for a demo. Do not add a new public export just for this demo.

- [ ] **Step 8.5: Add a header explaining the demo**

Above the grid, add a short explanation:

```tsx
<header style={{ marginBottom: 12 }}>
  <h2>Rotated resize: the math, with counterexamples</h2>
  <p>
    Resizing a rotated rect requires three coordinated steps. Each panel
    below runs the same drag against the same starting pose, but skips one
    step. Drag a corner of the green rect (full math) and compare its
    behavior to the others.
  </p>
  <ul>
    <li><strong>Full math (green):</strong> drag is projected into local frame, anchor math runs there, position is corrected so the diagonal corner stays pinned.</li>
    <li><strong>No projection (orange):</strong> drag delta applied in world frame — distorts on rotation.</li>
    <li><strong>No correction (purple):</strong> projection on; position correction disabled — the perceived fixed corner drifts.</li>
  </ul>
  <p>See <code>docs/superpowers/specs/2026-05-09-rotated-resize-design.md</code> §B for the math.</p>
</header>
```

- [ ] **Step 8.6: Manual smoke test**

Run: `npm run dev`. Open the math-explainer demo. Verify:

1. Full-math panel: drag any corner; the diagonally opposite world-space corner is pinned.
2. No-projection panel: drag any corner; the leaf distorts (stretches along world axes).
3. No-correction panel: drag any corner; the leaf scales but the perceived fixed corner drifts.
4. Ledger captions update live during drag for each panel.

- [ ] **Step 8.7: Run the full prepublish gate**

Run: `npm run prepublishOnly`
Expected: clean — `tsc --noEmit && vitest run && tsup build` all pass.

- [ ] **Step 8.8: Commit**

```bash
git add demo/demos/RotatedResizeMathDemo.tsx
git commit -m "demo(rotated-resize): counterexample panels + anchor-invariant ledger"
```

---

## Task 9: Update kit-internal docs

**Files:**
- Modify: `docs/TODO.md` — strike the rotated-resize entry under "Groupable objects."
- Modify: `CHANGELOG.md` (if one exists at repo root; check first).

- [ ] **Step 9.1: Update `docs/TODO.md`**

Find the entry around line 157 ("Resize on a rotated object still operates against the AABB (deferred — see RotateDemo description)"). Replace with a "shipped" note pointing at this plan + the spec:

```markdown
  - Resize on a rotated object now operates in the leaf's local frame and
    pins the diagonally opposite world-space corner. See
    `docs/superpowers/specs/2026-05-09-rotated-resize-design.md` and
    `docs/superpowers/plans/2026-05-09-rotated-resize.md`. Group resize
    with rotated children remains deferred (dev warning + AABB-frame
    fallback); see the spec's §F.
```

- [ ] **Step 9.2: Add a CHANGELOG entry (if applicable)**

```bash
ls CHANGELOG.md 2>/dev/null
```

If the file exists, add an entry under the unreleased / next version section:

```markdown
- **Rotated resize.** `useResize` now operates in the leaf's local frame
  when the pose carries rotation: the drag delta is projected through
  `R(−θ)`, anchor math runs in local frame, and the diagonally opposite
  world-space corner is pinned. New `ROTATED_POSE_DESCRIPTOR` (extends
  `PoseDescriptor` with optional `getRotation`). Hit-test rotates handle
  positions to match the overlay. Bit-identical for unrotated leaves.
  Group resize with rotated children remains unsupported (dev warning).
```

If no CHANGELOG exists, skip this step.

- [ ] **Step 9.3: Commit**

```bash
git add docs/TODO.md
[ -f CHANGELOG.md ] && git add CHANGELOG.md
git commit -m "docs: rotated resize — TODO + CHANGELOG"
```

---

## Task 10: Final regression sweep

- [ ] **Step 10.1: Run prepublishOnly**

Run: `npm run prepublishOnly`
Expected: PASS — `tsc --noEmit && vitest run && tsup build` all green.

- [ ] **Step 10.2: Run the full demo manually**

Run: `npm run dev`. Smoke-test:

1. Every existing demo (especially ResizeDemo, GroupDemo, RotateDemo) for regressions.
2. RotatedResizeMathDemo: all panels behave per §G of the spec.
3. RotateDemo with rotated resize opt-in: rotate → resize → rotate sequence has no pivot drift.

- [ ] **Step 10.3: Final commit (if cleanup needed)**

If any final tweaks emerged from steps 10.1–10.2, commit them. Otherwise nothing to do — work is done.
