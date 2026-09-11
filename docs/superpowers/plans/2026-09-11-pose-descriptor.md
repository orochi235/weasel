# One Pose Descriptor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every built-in action, painter and chrome surface in `@weasel-js/core` read pose geometry through one consumer-supplied `PoseDescriptor`, so a pose that is neither a rect nor a Path works end to end.

**Architecture:** `PoseProjection` becomes `PoseDescriptor` and gains `fromBounds` and `withRotation`. SceneCanvas takes a `poseDescriptor` prop and publishes it as a `poseDescriptor` dep that every built-in action reads; surfaces outside SceneCanvas take it as an option. A test-only circle pose (`{cx, cy, r}`) is the probe: each fix is watched failing on it first.

**Tech Stack:** TypeScript, React 19, vitest (jsdom), npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-11-pose-descriptor-design.md`. Read it first.

---

## Ground rules for every task

- **Worktree:** everything happens in `/Users/mike/src/weasel-pose` on branch `pose-descriptor`. Use absolute paths. Never touch `/Users/mike/src/weasel`.
- **Typecheck:** `npx tsc --noEmit` from `/Users/mike/src/weasel-pose`. Never `tsc -p packages/core` (31 pre-existing TS6059 errors).
- **One test file:** `npx vitest run --project=core <path>`. `packages/d3` and `packages/diagram` tests run under `--project=weasel-ui`; `apps/*` tests under `--project=draw`.
- **Never run the full suite while iterating.** Task 14 runs it once. Before any vitest run, `pgrep -fl vitest` — if another run is live, wait.
- **No browser.** Do not launch Chrome, Playwright or a dev server.
- **Stage explicit paths.** Never `git add -A`. Never commit `package-lock.json`.
- **Watch it fail.** Every new test is run before its fix and must fail for the stated reason. If it passes, the test is wrong — stop and fix the test.
- **Comments:** 1–2 lines, only where the code can't say it. Don't write "moved from" or dated notes.

---

## File map

| File | Change |
|---|---|
| `packages/core/src/interactions/actions/resize/geometry.ts` | `PoseDescriptor` (renamed), `fromBounds`, `withRotation`, plus `translatePoseViaDescriptor` / `visualBoundsViaDescriptor` moved in |
| `packages/core/src/interactions/actions/resize/autoPoseDescriptor.ts` | `fromBounds`, `withRotation`; `isRectPose` |
| `packages/core/src/features/paths/poseDescriptor.ts` | `fromBounds` |
| `packages/core/src/core/testkit/circlePose.ts` | **new** — test-only circle pose + descriptor |
| `packages/core/src/interactions/actions/poseDescriptorDep.ts` | **new** — `poseDescriptorOf` |
| `packages/core/src/canvas/deps/poseDescriptor.ts` | **new** — `usePoseDescriptorDepSource` |
| `packages/core/src/interactions/actions/depSchema.ts` | `poseDescriptor` entry; `ResizePolicy.projection` removed |
| `packages/core/src/interactions/actions/defaults/{move,resize,rotate,flip,nudge,align,distribute,group,clone,duplicate}.ts(x)` | read the dep |
| `packages/core/src/core/scene/{kitRegistry,scene,types}.ts` | `unionOfChildrenVia`, `Scene.registry` |
| `packages/core/src/canvas/{Canvas,SceneCanvas,CanvasView,useViewHelpers,viewInputs,sceneAdapter,MinimapCanvas,minimapMath,NodeShape}.ts(x)` | prop, wiring, options |
| `packages/core/src/canvas/SceneCanvas/{useSceneSelectTool,poseGeometry}.ts` | cascade, bounds, picking |
| `packages/core/src/canvas/deps/{hitTestArea,areaSelect,lassoSelect,editAnchors,resizePolicy}.ts` | descriptor param |
| `packages/core/src/core/adapters/arrayAdapter.ts`, `features/groups/nestedHit.ts`, `features/selection/overlay.ts`, `tools/builtin/select/useSelectTool.ts` | `poseDescriptor` option |
| `packages/core/src/features/guides/alignment/*` | descriptor instead of `AlignBoundsProjection` |
| `packages/core/src/animation/behaviors/momentum.ts` | `poseDescriptor` option |
| `packages/d3`, `packages/diagram`, `apps/site` | renames, two demo migrations |
| `.changeset/pose-descriptor.md` | **new** |

---

### Task 0: Install

- [ ] **Step 1: Install dependencies in the worktree**

```bash
cd /Users/mike/src/weasel-pose
npm install
git status -s
```

Expected: install succeeds. If `package-lock.json` shows as modified, run `git checkout -- package-lock.json`.

- [ ] **Step 2: Baseline typecheck**

Run: `npx tsc --noEmit` from `/Users/mike/src/weasel-pose`.
Expected: exit 0. If not, stop and report — the baseline is broken and nothing below can be trusted.

---

### Task 1: Rename the type and collapse the box twins

Pure type refactor; `tsc` is the test.

**Files:** every file listed in the spec's inventory; the commands below find them.

- [ ] **Step 1: Rename `PoseProjection` → `PoseDescriptor` everywhere**

```bash
cd /Users/mike/src/weasel-pose
grep -rlw 'PoseProjection' packages apps docs --include='*.ts' --include='*.tsx' --include='*.md' \
  | grep -v node_modules | grep -v '/dist/' \
  | xargs perl -pi -e 's/\bPoseProjection\b/PoseDescriptor/g'
grep -rnw 'PoseProjection' packages apps --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '/dist/'
```

Expected: the final grep prints nothing. (`docs/superpowers/specs/2026-08-22-3d-kernel-design.md` does not mention it; any doc hits are fine to rename.)

- [ ] **Step 2: Replace `ResizePose` with `Bounds`**

`ResizePose` is defined in `packages/core/src/interactions/gestures/types.ts` (line ~118) and `RotatedPose extends ResizePose` right below it. Edit that file:

Delete the `ResizePose` interface:

```ts
/** Minimum rect-shaped pose required by the resize machinery. */
export interface ResizePose {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

Add at the top of the file with the other type imports:

```ts
import type { Bounds } from 'core/viewport/fitViewToBounds';
```

Change `RotatedPose` to:

```ts
/** `Bounds` with a required rotation angle (radians). Pivot is the AABB
 *  center of the unrotated `{x, y, width, height}`. */
export interface RotatedPose extends Bounds {
  rotation: number;
}
```

Then rewrite every other use:

```bash
cd /Users/mike/src/weasel-pose
grep -rlw 'ResizePose' packages apps --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '/dist/' \
  | xargs perl -pi -e 's/\bResizePose\b/Bounds/g'
```

This leaves broken or duplicate imports (`import type { Bounds } from '../../gestures/types'`, or `Bounds` imported twice). Fix each by hand: `Bounds` comes from `'core/viewport/fitViewToBounds'` inside `packages/core/src`, and from `'@weasel-js/core'` elsewhere. Two local aliases need attention:

- `packages/core/src/interactions/actions/defaults/resize.deps.test.ts:33` `type RectPose = ResizePose;` → becomes `type RectPose = Bounds;` — fine.
- The behavior tests' `type P = ResizePose;` → `type P = Bounds;` — fine.

In `packages/core/src/index.ts`, delete `ResizePose,` from the `export type {…} from './interactions/gestures/types'` block (line ~882). `Bounds` is already exported (line ~109).

In `apps/site/demos/RotatedResizeMathDemo.tsx`, the perl pass turns the `ResizePose` import into a second `Bounds` import from `@weasel-js/core`; merge it into the existing type import.

- [ ] **Step 3: Replace `AlignBounds` with `Bounds`**

In `packages/core/src/features/guides/alignment/types.ts`, delete:

```ts
/** Axis-aligned bounding box. Alignment matches AABBs throughout; a rotated
 *  pose enters as the AABB of its ink (see `AlignBoundsProjection.boundsOf`). */
export interface AlignBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

and add `import type { Bounds } from 'core/viewport/fitViewToBounds';`. Then:

```bash
cd /Users/mike/src/weasel-pose/packages/core/src
perl -pi -e 's/\bAlignBounds\b(?!Projection)/Bounds/g' features/guides/alignment/*.ts
```

Fix imports in `match.ts`, `derive.ts`, `behaviors.ts` (take `Bounds` from `'core/viewport/fitViewToBounds'`). Remove `AlignBounds,` from `features/guides/alignment/index.ts` and from `packages/core/src/index.ts` (line ~952).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. Any remaining error is an import to fix, not a design change — if one isn't, stop and report it.

- [ ] **Step 5: Run the files the rename touched most**

```bash
npx vitest run --project=core packages/core/src/interactions/actions/resize packages/core/src/features/guides/alignment packages/core/src/interactions/actions/defaults/resize.deps.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/mike/src/weasel-pose
git add -u packages apps docs
git status -s   # confirm only renamed files are staged, no package-lock.json
git commit -m "rename PoseProjection to PoseDescriptor and fold ResizePose and AlignBounds into Bounds"
```

---

### Task 2: `fromBounds`, `withRotation`, and the two helpers

**Files:**
- Modify: `packages/core/src/interactions/actions/resize/geometry.ts`
- Modify: `packages/core/src/interactions/actions/resize/autoPoseDescriptor.ts`
- Modify: `packages/core/src/features/paths/poseDescriptor.ts`
- Modify: `packages/core/src/interactions/actions/align/align.ts`
- Modify: `packages/core/src/interactions/actions/rotate/options.ts`, `rotate/index.ts`, `packages/core/src/index.ts`
- Test: `packages/core/src/interactions/actions/resize/geometry.test.ts`, `autoPoseDescriptor.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/interactions/actions/resize/geometry.test.ts`:

```ts
describe('fromBounds / withRotation', () => {
  const box = { x: 1, y: 2, width: 30, height: 40 };

  it('RECT builds a plain rect and drops the template rotation', () => {
    expect(RECT_POSE_DESCRIPTOR.fromBounds(box, { x: 9, y: 9, width: 1, height: 1 }))
      .toEqual(box);
  });

  it('ROTATED builds an unrotated rect', () => {
    expect(ROTATED_POSE_DESCRIPTOR.fromBounds(box, { x: 0, y: 0, width: 1, height: 1, rotation: 1 }))
      .toEqual({ ...box, rotation: 0 });
  });

  it('RECT and ROTATED write rotation', () => {
    expect(RECT_POSE_DESCRIPTOR.withRotation!({ ...box }, 0.5)).toEqual({ ...box, rotation: 0.5 });
    expect(ROTATED_POSE_DESCRIPTOR.withRotation!({ ...box, rotation: 0 }, 0.5))
      .toEqual({ ...box, rotation: 0.5 });
  });
});
```

Append to `packages/core/src/interactions/actions/resize/autoPoseDescriptor.test.ts` (add imports for `pathPoseDescriptor` from `'features/paths/poseDescriptor'` if not present):

```ts
describe('AUTO fromBounds / withRotation', () => {
  const box = { x: 1, y: 2, width: 30, height: 40 };

  it('matches a path template with a rect Path', () => {
    const template = { kind: 'rect' as const, x: 0, y: 0, width: 1, height: 1 };
    expect(AUTO_POSE_DESCRIPTOR.fromBounds(box, template)).toEqual({ kind: 'rect', ...box });
  });

  it('matches a rect template with a plain rect', () => {
    expect(AUTO_POSE_DESCRIPTOR.fromBounds(box, { x: 0, y: 0, width: 1, height: 1, rotation: 2 }))
      .toEqual(box);
  });

  it('rotates rects and refuses paths', () => {
    expect(AUTO_POSE_DESCRIPTOR.withRotation!({ ...box }, 1)).toEqual({ ...box, rotation: 1 });
    const path = { kind: 'rect' as const, ...box };
    expect(AUTO_POSE_DESCRIPTOR.withRotation!(path, 1)).toBe(path);
  });

  it('pathPoseDescriptor.fromBounds returns a rect Path', () => {
    expect(pathPoseDescriptor.fromBounds(box, { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }))
      .toEqual({ kind: 'rect', ...box });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project=core packages/core/src/interactions/actions/resize/geometry.test.ts packages/core/src/interactions/actions/resize/autoPoseDescriptor.test.ts`
Expected: FAIL — `fromBounds is not a function` / `withRotation` undefined.

- [ ] **Step 3: Extend the interface and the rect descriptors**

In `packages/core/src/interactions/actions/resize/geometry.ts`, add to `interface PoseDescriptor<TPose>` after `remapBounds`:

```ts
  /** A pose occupying `bounds`, of the same kind as `template`. Unlike
   *  `remapBounds`, the result carries none of the template's shape. */
  fromBounds(bounds: Bounds, template: TPose): TPose;
```

and after `supportsRotation?`:

```ts
  /** Write a rotation (radians) into the pose, bounds unchanged. Absent means
   *  the pose cannot carry one, and the rotate action leaves it alone. */
  withRotation?(pose: TPose, rotation: number): TPose;
```

Add to `RECT_POSE_DESCRIPTOR`:

```ts
  fromBounds: (b) => ({ x: b.x, y: b.y, width: b.width, height: b.height }),
  withRotation: (p, rotation) => ({ ...p, rotation }),
```

Add to `ROTATED_POSE_DESCRIPTOR`:

```ts
  fromBounds: (b) => ({ x: b.x, y: b.y, width: b.width, height: b.height, rotation: 0 }),
  withRotation: (p, rotation) => ({ ...p, rotation }),
```

Move the two helpers from `packages/core/src/interactions/actions/align/align.ts` into the end of `geometry.ts` (import `axisAlignedBounds` from `'core/geometry/unionBounds'`):

```ts
/** The pose's visual bounds: its frame expanded to cover the rotated
 *  rectangle, so a turned shape reports the extent of its ink. */
export function visualBoundsViaDescriptor<TPose>(
  pose: TPose,
  geometry: PoseDescriptor<TPose>,
): Bounds {
  const b = geometry.getBounds(pose);
  const rotation =
    geometry.getRotation?.(pose) ?? (b as { rotation?: number }).rotation ?? 0;
  return axisAlignedBounds({ x: b.x, y: b.y, width: b.width, height: b.height, rotation });
}

/** Translate through `geometry.translate`, or via `remapBounds` onto a shifted
 *  copy of the pose's own bounds when the descriptor has none. */
export function translatePoseViaDescriptor<TPose>(
  pose: TPose,
  dx: number,
  dy: number,
  geometry: PoseDescriptor<TPose>,
): TPose {
  if (geometry.translate) return geometry.translate(pose, dx, dy);
  const src = geometry.getBounds(pose);
  const dst = { x: src.x + dx, y: src.y + dy, width: src.width, height: src.height };
  return geometry.remapBounds(pose, src, dst);
}
```

In `align/align.ts`, delete both function bodies and replace them with:

```ts
export { visualBoundsViaDescriptor, translatePoseViaDescriptor } from '../resize/geometry';
import { visualBoundsViaDescriptor, translatePoseViaDescriptor } from '../resize/geometry';
```

(`packages/core/src/index.ts` keeps exporting both names from wherever it does today.)

- [ ] **Step 4: The path and auto descriptors**

In `packages/core/src/features/paths/poseDescriptor.ts`, add to `pathPoseDescriptor`:

```ts
  fromBounds: (b) => ({ kind: 'rect', x: b.x, y: b.y, width: b.width, height: b.height }),
```

In `packages/core/src/interactions/actions/resize/autoPoseDescriptor.ts`, add after `isPathLike`:

```ts
/** True for a pose with numeric top-level `x`/`y`/`width`/`height` — the only
 *  shape the rect descriptor and the kit's built-in painters can read. */
export function isRectPose(p: unknown): p is { x: number; y: number; width: number; height: number; rotation?: number } {
  if (!p || typeof p !== 'object') return false;
  const r = p as Record<string, unknown>;
  return typeof r.x === 'number' && typeof r.y === 'number'
    && typeof r.width === 'number' && typeof r.height === 'number';
}
```

and add to `AUTO_POSE_DESCRIPTOR`:

```ts
  fromBounds: (b, template) => isPathLike(template)
    ? pathPoseDescriptor.fromBounds(b, template)
    : RECT_POSE_DESCRIPTOR.fromBounds(b, template as Bounds),
  withRotation: (p, rotation) => isPathLike(p) ? p : { ...(p as object), rotation },
```

(import `type Bounds` from `'core/viewport/fitViewToBounds'`). Export `isRectPose` from `packages/core/src/interactions/actions/resize/index.ts` next to `isPathLike`, and from `packages/core/src/index.ts` next to `isPathLike` (line ~965).

- [ ] **Step 5: Delete `RotateGeometry`**

In `packages/core/src/interactions/actions/rotate/options.ts`, delete the `RotateGeometry` interface and the `geometry?: RotateGeometry<TPose>;` member of `UseRotateOptions` (with its doc comment). Change the `behaviors` doc line "typed `never` until you supply a `geometry`" to "typed `never` for a pose without a numeric `rotation`". Remove `RotateGeometry` from `rotate/index.ts` and from `packages/core/src/index.ts` (line ~989). In `defaults/rotate.ts`, delete the two doc sentences that mention `RotateGeometry` (lines ~21–22 and ~125–126); Task 6 rewrites that header anyway.

- [ ] **Step 6: Make every hand-written descriptor supply `fromBounds`**

Run `npx tsc --noEmit`. Each error "Property 'fromBounds' is missing" is a descriptor literal. Fix each:

- A literal spreading `RECT_POSE_DESCRIPTOR` or `ROTATED_POSE_DESCRIPTOR` (e.g. `RotatedResizeMathDemo.tsx`) inherits it — no change.
- A test literal cast `as PoseDescriptor<unknown>` compiles already — no change.
- Any other literal gets `fromBounds: (b) => ({ ...b })` if its pose is rect-shaped; otherwise stop and report it.

Expected after fixes: exit 0.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run --project=core packages/core/src/interactions/actions/resize packages/core/src/interactions/actions/align packages/core/src/features/paths`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -u packages apps
git commit -m "add fromBounds and withRotation to PoseDescriptor and delete RotateGeometry"
```

---

### Task 3: The circle probe

**Files:**
- Create: `packages/core/src/core/testkit/circlePose.ts`
- Test: `packages/core/src/core/testkit/circlePose.test.ts`

- [ ] **Step 1: Write the fixture**

```ts
// packages/core/src/core/testkit/circlePose.ts
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';

/** Test-only pose that is neither a rect nor a Path, so nothing built in can
 *  read it except through its descriptor. */
export interface CirclePose { cx: number; cy: number; r: number }

export const circle = (cx: number, cy: number, r: number): CirclePose => ({ cx, cy, r });

export const CIRCLE_POSE_DESCRIPTOR: PoseDescriptor<CirclePose> = {
  getBounds: (p) => ({ x: p.cx - p.r, y: p.cy - p.r, width: 2 * p.r, height: 2 * p.r }),
  remapBounds: (p, src, dst) => {
    const sx = src.width === 0 ? 1 : dst.width / src.width;
    const sy = src.height === 0 ? 1 : dst.height / src.height;
    return {
      cx: dst.x + (p.cx - src.x) * sx,
      cy: dst.y + (p.cy - src.y) * sy,
      r: p.r * Math.min(Math.abs(sx), Math.abs(sy)),
    };
  },
  translate: (p, dx, dy) => ({ cx: p.cx + dx, cy: p.cy + dy, r: p.r }),
  fromBounds: (b) => ({
    cx: b.x + b.width / 2,
    cy: b.y + b.height / 2,
    r: Math.min(b.width, b.height) / 2,
  }),
  supportsRotation: () => false,
};
```

- [ ] **Step 2: Write its test**

```ts
// packages/core/src/core/testkit/circlePose.test.ts
import { describe, it, expect } from 'vitest';
import { circle, CIRCLE_POSE_DESCRIPTOR as D } from './circlePose';

describe('circle probe', () => {
  it('round-trips through its own bounds', () => {
    const c = circle(10, 20, 5);
    expect(D.getBounds(c)).toEqual({ x: 5, y: 15, width: 10, height: 10 });
    expect(D.fromBounds(D.getBounds(c), c)).toEqual(c);
    expect(D.translate!(c, 3, -4)).toEqual(circle(13, 16, 5));
  });
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run --project=core packages/core/src/core/testkit/circlePose.test.ts`
Expected: PASS. Also run `npm run check:test-projects` — expected: exits 0 (the fixture is not a test file; the test is collected by `core`).

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/core/testkit/circlePose.ts packages/core/src/core/testkit/circlePose.test.ts
git commit -m "add a test-only circle pose for probing descriptor bypasses"
```

---

### Task 4: The `poseDescriptor` dep, the prop, and the removed options

**Files:**
- Create: `packages/core/src/interactions/actions/poseDescriptorDep.ts`
- Create: `packages/core/src/canvas/deps/poseDescriptor.ts`
- Modify: `packages/core/src/interactions/actions/depSchema.ts`
- Modify: `packages/core/src/canvas/deps/resizePolicy.ts`, `canvas/deps/index.ts`, `packages/core/src/index.ts`
- Modify: `packages/core/src/interactions/actions/resize/options.ts`, `move/options.ts`
- Modify: `packages/core/src/interactions/actions/defaults/resize.ts`
- Modify: `packages/core/src/canvas/{Canvas,SceneCanvas,CanvasView,useViewHelpers,viewInputs}.tsx?`
- Test: `packages/core/src/interactions/actions/buildDeps.test.ts`, `packages/core/src/interactions/actions/defaults/resize.deps.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/core/src/interactions/actions/buildDeps.test.ts`, find the `it.each` at lines ~40–55 that asserts `deps.geometryProjection` resolves for move/resize/flip/nudge, and add a sibling:

```ts
it.each([
  ['move', moveAction], ['resize', resizeAction], ['rotate', rotateAction],
  ['flip', flipAction], ['nudge-left', nudgeLeftAction], ['group', groupAction],
  ['clone', cloneAction], ['duplicate', duplicateAction],
  ['align-left', alignLeftAction], ['distribute-x', distributeHorizontalAction],
])('%s declares poseDescriptor', (_name, action) => {
  expect((action as { requires?: string[] }).requires).toContain('poseDescriptor');
});
```

Import the action constants the file does not already import (`rotateAction`, `groupAction`, `cloneAction`, `duplicateAction`, `alignLeftAction` from `./defaults/align`, the horizontal distribute action from `./defaults/distribute` — check the exported name there).

In `packages/core/src/interactions/actions/defaults/resize.deps.test.ts`, add:

```ts
describe('resizeAction — reads the poseDescriptor dep', () => {
  it('resizes a circle through its descriptor', () => {
    const invoker = getOngoing(resizeAction);
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: circle(50, 50, 50) } },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      deps: { poseDescriptor: CIRCLE_POSE_DESCRIPTOR as never },
    });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 100, y: 100 }, delta: { x: 0, y: 0 } },
    });
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 200, y: 200 }, delta: { x: 100, y: 100 } },
    });
    expect(handle.previewPose!('a')).toEqual(circle(100, 100, 100));
  });
});
```

Import `circle, CIRCLE_POSE_DESCRIPTOR` from `'core/testkit/circlePose'`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project=core packages/core/src/interactions/actions/buildDeps.test.ts packages/core/src/interactions/actions/defaults/resize.deps.test.ts`
Expected: FAIL — `requires` lacks `poseDescriptor`; the circle preview has `x`/`y`/`width`/`height` fields (AUTO's rect branch) instead of `circle(100, 100, 100)`. If the resize test throws instead ("read deps.poseDescriptor but did not declare it"), that is also the expected failure.

- [ ] **Step 3: The dep entry and the reader**

In `packages/core/src/interactions/actions/depSchema.ts`, add to `DepSchema` after `resizePolicy`:

```ts
  /**
   * How to read and rewrite a pose — bounds, translate, remap, rotation. Every
   * built-in action that touches a pose reads it. Sourced by `<SceneCanvas>`
   * from its `poseDescriptor` prop; `AUTO_POSE_DESCRIPTOR` when absent.
   */
  poseDescriptor?: PoseDescriptor<unknown>;
```

In the same file, delete `projection` from `ResizePolicy<TPose>` (with its doc comment), and delete "and pose↔bounds projection" / "`RECT_POSE_DESCRIPTOR`" wording from the `resizePolicy` doc comment.

Create `packages/core/src/interactions/actions/poseDescriptorDep.ts`:

```ts
import type { PoseDescriptor } from './resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from './resize/autoPoseDescriptor';

/** The `poseDescriptor` dep's value, or the auto descriptor when unsourced. */
export function poseDescriptorOf(dep: unknown): PoseDescriptor<unknown> {
  return (dep as PoseDescriptor<unknown> | undefined) ?? AUTO_POSE_DESCRIPTOR;
}
```

Create `packages/core/src/canvas/deps/poseDescriptor.ts`:

```ts
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';

/** Publish the pose descriptor every built-in action reads. */
export function usePoseDescriptorDepSource(
  descriptor: PoseDescriptor<unknown> | undefined,
): void {
  const ref = useRef(descriptor);
  ref.current = descriptor;
  useDepSource('poseDescriptor', () => ref.current ?? AUTO_POSE_DESCRIPTOR);
}
```

Export it from `packages/core/src/canvas/deps/index.ts` and from `packages/core/src/index.ts` beside `useResizePolicy` (line ~235).

- [ ] **Step 4: Remove `projection` from the resize policy hook**

In `packages/core/src/canvas/deps/resizePolicy.ts`: delete the `projection?` member of `UseResizePolicyOptions`, the `projection:` line in the returned object, the `PoseDescriptor` and `AUTO_POSE_DESCRIPTOR` imports, and the `projection` bullet plus the AUTO paragraph from the file header.

- [ ] **Step 5: Remove `geometry` from `UseResizeOptions` and `translatePose` from `UseMoveOptions`**

In `packages/core/src/interactions/actions/resize/options.ts`, delete `geometry?: PoseDescriptor<TPose>;` with its doc and the now-unused import; change the behaviors doc "When `TPose` is non-rect, pass `geometry`…" to "For a non-rect `TPose`, constraints are typed `never`; the pose descriptor comes from `<SceneCanvas poseDescriptor>`." In `packages/core/src/interactions/actions/move/options.ts`, delete `translatePose?` and its doc.

- [ ] **Step 6: The resize action reads the dep**

In `packages/core/src/interactions/actions/defaults/resize.ts`:

`requires` (line ~284) becomes:

```ts
  requires: ['selection', 'scene', 'resizePolicy', 'poseDescriptor', 'applyOps', 'geometryProjection'],
```

`resolveDeps` (lines ~77–103) becomes:

```ts
function resolveDeps(ctx: InvocationCtx): {
  behaviors: BoundsConstraint<Bounds>[];
  pointSnap: PointSnapBehavior<Bounds>[];
  expandIds: (ids: string[]) => string[];
  geometry: PoseDescriptor<unknown>;
} {
  const geometry = poseDescriptorOf(ctx.deps.poseDescriptor);
  const dep = ctx.deps.resizePolicy as ResizePolicy<unknown> | undefined;
  if (!dep) {
    return {
      // Standard kit behaviors (shift = aspect lock) apply even with no
      // policy wired; consumers opt out via an explicit `behaviors: []`.
      behaviors: DEFAULT_RESIZE_BEHAVIORS as BoundsConstraint<Bounds>[],
      pointSnap: EMPTY_POINT_SNAP,
      expandIds: IDENTITY_EXPAND,
      geometry,
    };
  }
  return {
    behaviors: dep.constraints as unknown as BoundsConstraint<Bounds>[],
    pointSnap: dep.pointSnap as unknown as PointSnapBehavior<Bounds>[],
    expandIds: dep.expandIds,
    geometry,
  };
}
```

Delete `defaultTranslate` (lines ~109–111) and change its one use (line ~469):

```ts
              proposedPose = translatePoseViaDescriptor(proposedPose, correctionX, correctionY, scratch.geometry);
```

Import `poseDescriptorOf` from `'../poseDescriptorDep'` and `translatePoseViaDescriptor` from `'../resize/geometry'`; drop the `AUTO_POSE_DESCRIPTOR` import if unused. Update the module doc (lines ~11–35): replace every mention of `geometry` coming from `resizePolicy` with "the `poseDescriptor` dep".

- [ ] **Step 7: Fix the resize tests that passed `projection`**

`resize.deps.test.ts` passes `resizePolicy: { …, projection: X }` at lines ~108, 142, 162, 196, 235, 297, 384. For each: delete the `projection:` line from the `resizePolicy` object and add `poseDescriptor: X` to the same `deps` object. Rename the describe at line ~287 to `'resizeAction — geometry via poseDescriptor dep'`.

- [ ] **Step 8: Rename Canvas's prop and thread SceneCanvas's**

`packages/core/src/canvas/Canvas.tsx`:
- Prop (line ~297): rename `geometry?: PoseDescriptor<TPose>;` to `poseDescriptor?: PoseDescriptor<TPose>;`. Doc comment's first line becomes "How to read and rewrite a pose. Drives the default `boundsOf` fallback and the selection-overlay bounds."
- Destructure (line ~773): `poseDescriptor: geometry = AUTO_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>,` — the local name stays `geometry` so the rest of the body is untouched.
- Line ~309 doc: "the `geometry`-derived fallback" → "the `poseDescriptor`-derived fallback".

`packages/core/src/canvas/SceneCanvas.tsx`:
- In the `SceneCanvasProps` `Omit` list (line ~306) delete `| 'geometry'` from `'selection' | 'selectionOptions' | 'tools' | 'geometry'`. Canvas no longer has that key, and SceneCanvas keeps its own unrelated `geometry` (picking) prop.
- Add to the SceneCanvas-own props, just above `geometry?: {` (line ~380):

```ts
    /** How to read and rewrite this scene's poses. Every built-in action,
     *  the selection chrome and picking read it. Default `AUTO_POSE_DESCRIPTOR`
     *  (rect poses and `Path` poses). */
    poseDescriptor?: PoseDescriptor<TPose>;
```

- Destructure it at line ~849: add `poseDescriptor,` after `geometry,`, and immediately after the destructure:

```ts
  const descriptor = (poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<unknown>;
```

- `viewInputs` (line ~1949): `geometry: descriptor,` and add `descriptor` to its dependency list.
- Overlay (line ~1851): `getBounds: cfg.getBounds ?? ((p: TPose) => AUTO_POSE_DESCRIPTOR.getBounds(p) as Bounds),` stays until Task 9 changes the overlay API.
- The `<Canvas …>` element (line ~1960): add `poseDescriptor={descriptor as PoseDescriptor<TPose>}`.
- `StandardActionsRegistrar` element (line ~2036): add `poseDescriptor={descriptor}`; its props interface (line ~2440): add `poseDescriptor: PoseDescriptor<unknown>;`; its destructure: add `poseDescriptor`; and next to `useDispatcherDepSource(dispatcher);` (line ~2589):

```ts
  usePoseDescriptorDepSource(poseDescriptor);
```

- `ResizePolicyRegistrar` (line ~2620): delete `projection: options.geometry,`.

`packages/core/src/canvas/useViewHelpers.ts` and `viewInputs.tsx` keep the field name `geometry` — internal, not public.

- [ ] **Step 9: Migrate the two demos**

`apps/site/demos/TransformDemo.tsx` line ~36: delete `resize: { geometry: ROTATED_POSE_DESCRIPTOR as PoseDescriptor<RotatedPose> },` from `selectTool`, and pass `poseDescriptor={ROTATED_POSE_DESCRIPTOR as PoseDescriptor<RotatedPose>}` on the `<SceneCanvas>` element instead. Update the doc comment at line ~18 to say the descriptor goes on SceneCanvas.

`apps/site/demos/PointSnapDemo.tsx` lines ~45–50: delete `projection: ROTATED_POSE_DESCRIPTOR as PoseDescriptor<Rect>,` from the `useResizePolicy` call and pass `poseDescriptor={ROTATED_POSE_DESCRIPTOR as PoseDescriptor<Rect>}` on its `<SceneCanvas>`. Update the comment above.

`packages/core/src/canvas/Canvas.test.tsx:674`: `geometry={ROTATED_POSE_DESCRIPTOR as never}` → `poseDescriptor={ROTATED_POSE_DESCRIPTOR as never}`.

- [ ] **Step 10: Typecheck and run**

Run: `npx tsc --noEmit` — expected exit 0.
Run: `npx vitest run --project=core packages/core/src/interactions/actions/defaults/resize.deps.test.ts packages/core/src/interactions/actions/defaults/resize.test.ts packages/core/src/canvas/Canvas.test.tsx packages/core/src/canvas/SceneCanvas.tools.test.tsx`
Expected: PASS. `buildDeps.test.ts` still fails for every action except resize — Tasks 5–7 add `poseDescriptor` to their `requires`. Leave that failure standing until Task 7.

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/interactions/actions/poseDescriptorDep.ts packages/core/src/canvas/deps/poseDescriptor.ts
git add -u packages apps
git commit -m "publish a poseDescriptor dep from SceneCanvas and read it in resize"
```

---

### Task 5: Move

**Files:**
- Modify: `packages/core/src/interactions/actions/defaults/move.ts`
- Test: `packages/core/src/interactions/actions/defaults/move.descriptor.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/interactions/actions/defaults/move.descriptor.test.ts
import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import type { InvocationCtx, BindingOpts } from '../invoker';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import type { LayoutStrategy } from '../../../layout/types';
import { circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose } from 'core/testkit/circlePose';

type S = Scene<object, 'main', CirclePose>;

function circleScene(): S {
  return createScene<object, 'main', CirclePose>({ systemLayers: [{ id: 'main' }] });
}

function drag(
  scene: S,
  ids: string[],
  delta: { x: number; y: number },
  deps: Record<string, unknown> = {},
  opts?: BindingOpts,
): void {
  const invoker = moveAction.invoker;
  if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const base = {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => ids as NodeId[] },
      scene: scene as Scene<unknown, string, unknown>,
      poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
      ...deps,
    },
  };
  const d = { start: { x: 0, y: 0 }, current: { x: delta.x, y: delta.y }, delta };
  const handle = invoker.start(base as InvocationCtx, opts);
  handle.onMove!({ ...base, drag: d } as InvocationCtx);
  handle.onEnd!({ ...base, world: d.current, drag: d } as InvocationCtx, 'commit');
}

describe('moveAction — non-rect poses through the descriptor', () => {
  it('translates a circle without writing rect fields', () => {
    const scene = circleScene();
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: circle(10, 10, 5), data: {} });
    drag(scene, [id], { x: 20, y: 0 });
    expect(scene.get(id)!.pose).toEqual(circle(30, 10, 5));
  });

  it('drops a circle into a container without NaN', () => {
    const scene = circleScene();
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: circle(0, 0, 5), data: {} });
    const box = scene.add({ kind: 'container', layer: 'main', pose: circle(100, 100, 50), data: {} });
    drag(scene, [id], { x: 100, y: 100 }, { nodeAtPoint: () => box }, { params: { reparentOnDrop: 'top' } });
    expect(scene.get(id)!.parent).toBe(box);
    expect(scene.get(id)!.pose).toEqual(circle(100, 100, 5));
  });

  it('finds a layout container under a dragged circle and probes at the pointer', () => {
    const scene = circleScene();
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: circle(0, 0, 5), data: {} });
    const box = scene.add({ kind: 'container', layer: 'main', pose: circle(100, 100, 50), data: {} });
    const probes: { x: number; y: number }[] = [];
    const layout = {
      snap: { pickTarget: (t: unknown[], p: { x: number; y: number }) => { probes.push(p); return t[0] ?? null; } },
      childPoses: () => new Map(),
      getDropTargets: (_c: unknown, _k: unknown, dragged: { pose: unknown }) =>
        [{ pose: dragged.pose, origin: { x: 0, y: 0 } }],
      reflowPoses: () => new Map(),
      commitDrop: () => [],
    } as unknown as LayoutStrategy<unknown>;
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => [id] as NodeId[] },
        scene: scene as Scene<unknown, string, unknown>,
        poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
        layout: { getLayout: (cid: string) => (cid === box ? layout : null) },
      },
    };
    const handle = invoker.start(base as InvocationCtx, undefined);
    handle.onMove!({
      ...base,
      drag: { start: { x: 0, y: 0 }, current: { x: 100, y: 100 }, delta: { x: 100, y: 100 } },
    } as InvocationCtx);
    expect(probes).toEqual([{ x: 100, y: 100 }]);
  });
});
```

Check the `LayoutDep` shape in `depSchema.ts` before running; if it is not `{ getLayout(id) }`, match it.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project=core packages/core/src/interactions/actions/defaults/move.descriptor.test.ts`
Expected: FAIL. Test 1 fails with `NaN` `x`/`y` fields on the pose (AUTO's rect translate, since the dep is not read yet). Test 2 fails the same way on the reparent path. Test 3 fails with `probes` empty (the selection center is `NaN`, so no container is found).

- [ ] **Step 3: Read the dep and replace the rect reads**

In `packages/core/src/interactions/actions/defaults/move.ts`:

1. `requires` (line ~631): replace `'resizePolicy'` with `'poseDescriptor'`.
2. In `start` (lines ~637–642), replace the `policy`/`projection` lines with:

```ts
      const projection = poseDescriptorOf(ctx.deps.poseDescriptor);
```

3. `MoveScratch.projection` (line ~461) becomes `projection: PoseDescriptor<unknown>;` (not optional); rewrite its doc to "Pose descriptor captured at drag start."
4. Replace `translatePoseGeneric` (lines ~86–99) with nothing, and every call `translatePoseGeneric(x, dx, dy, scratch.projection)` with `translatePoseViaDescriptor(x, dx, dy, scratch.projection)` (lines ~348, 739, 764, 797).
5. Retype the pose adapter (lines ~396–403):

```ts
function scenePoseAdapter(
  scene: Scene<unknown, string, unknown>,
): PoseAdapter<unknown> {
  return {
    getPose: (id) => documentPose(scene, scene.get(id as NodeId)!),
    getParent: (id) => scene.get(id as NodeId)?.parent ?? null,
  };
}
```

and delete every `as PoseComposition<RectPose>` (lines ~111, 832, 906, 993), leaving `scratch.pc`; change `applyReparent`'s `pc: PoseComposition<RectPose>` parameter to `PoseComposition<unknown>`; change `createTransformOp<RectPose>` to `createTransformOp<unknown>` and the `as RectPose` casts on `a.from`/`a.to`/`pose`/`worldPose` (lines ~274, 307, 842, 847, 848, 885–888, 913–918) to plain `unknown`-typed values. The op-args casts become `op.args as { id: string; from: unknown; to: unknown; label?: string; coalesceKey?: string }`.

6. `runLayoutPass` world poses and selection box (lines ~125–159) become:

```ts
  const d = scratch.projection;
  const dragged: DraggedChild[] = [];
  for (const id of scratch.ids) {
    const node = scene.get(id);
    if (!node) continue;
    const startWorld = composeWorldPose(poseAdapter, id as string, pc.compose);
    const world = translatePoseViaDescriptor(startWorld, dx, dy, d);
    const b = d.getBounds(world);
    dragged.push({
      id,
      arg: {
        id: id as string,
        originPose: startWorld,
        pose: world,
        sourceContainerId: (node.parent ?? null) as string | null,
      },
      center: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    });
  }
  if (dragged.length === 0) return;
  const draggedIds = new Set<NodeId>(dragged.map((c) => c.id));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of dragged) {
    const b = d.getBounds(c.arg.pose);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
```

(keep the two comment blocks that were there; `const pc = scratch.pc;` replaces the cast line). Delete the local `boundsOf` at line ~182 and use `d.getBounds` in `consider`; delete the comment block above it (lines ~177–181).

7. Source container bounds (line ~291): `bounds: d.getBounds(composeWorldPose(poseAdapter, srcId, pc.compose)),`. The reflow change check (lines ~299–304) becomes:

```ts
    for (const [cid, pose] of srcLayout.childPoses(srcContainer, srcChildren)) {
      const cur = d.getBounds(composeWorldPose(poseAdapter, cid, pc.compose));
      const next = d.getBounds(pose);
      const same = cur.x === next.x && cur.y === next.y
        && cur.width === next.width && cur.height === next.height;
```

8. `releaseDrop` path (lines ~906–953): delete the local `boundsOf` (line ~908) and use `scratch.projection.getBounds(...)` for `srcContainer.bounds`; the released pose (line ~953) becomes `pose: translatePoseViaDescriptor(startWorld, dx, dy, scratch.projection),`.

9. `applyReparent` (lines ~553–558):

```ts
    const startWorld = composeWorldPose(poseAdapter, id, pc.compose);
    const draggedWorld = translatePoseViaDescriptor(startWorld, dx, dy, scratch.projection);
```

10. A behavior returning an override pose (lines ~748–751):

```ts
              } else if (r.pose !== undefined && primary !== undefined) {
                const o = scratch.startPoses.get(primary);
                if (o !== undefined) {
                  const from = scratch.projection.getBounds(o);
                  const to = scratch.projection.getBounds(r.pose);
                  transform = { kind: 'translate', dx: to.x - from.x, dy: to.y - from.y };
                }
              }
```

11. Imports: add `import { poseDescriptorOf } from '../poseDescriptorDep';`, `import { translatePoseViaDescriptor, type PoseDescriptor } from '../resize/geometry';`; remove `AUTO_POSE_DESCRIPTOR`, `ResizePolicy`, and `type RectPose` if unused. Rewrite the module doc's "Pose generics" section (lines ~38–44) to: "Poses are `unknown`; every read and write goes through the `poseDescriptor` dep (`AUTO_POSE_DESCRIPTOR` when unsourced)."

- [ ] **Step 4: Run the move tests**

```bash
npx vitest run --project=core packages/core/src/interactions/actions/defaults/move.descriptor.test.ts packages/core/src/interactions/actions/defaults/move.test.ts packages/core/src/interactions/actions/defaults/move.layout.test.ts
```

Expected: PASS. `move.layout.test.ts`'s PolygonPath container test still passes because its ctx has no `poseDescriptor` dep and AUTO handles paths.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit` — exit 0.

```bash
git add packages/core/src/interactions/actions/defaults/move.ts packages/core/src/interactions/actions/defaults/move.descriptor.test.ts
git commit -m "route every pose read and write in moveAction through the pose descriptor"
```

---

### Task 6: Rotate, flip, nudge, align, distribute, clone, duplicate

**Files:**
- Modify: `packages/core/src/interactions/actions/defaults/{rotate,flip,nudge,align,distribute,clone,duplicate}.ts(x)`, `packages/core/src/interactions/actions/flip/helpers.ts`
- Test: `packages/core/src/interactions/actions/defaults/descriptorActions.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/interactions/actions/defaults/descriptorActions.test.ts
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import type { ImmediateInvoker, InvocationCtx } from '../invoker';
import { flipAction } from './flip';
import { nudgeRightAction } from './nudge';
import { alignLeftAction } from './align';
import { distributeHorizontalAction } from './distribute';
import { duplicateAction } from './duplicate';
import { cloneAction } from './clone';
import { rotateAction } from './rotate';
import { circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose } from 'core/testkit/circlePose';

type S = Scene<object, 'main', CirclePose>;
const scene = (): S => createScene<object, 'main', CirclePose>({ systemLayers: [{ id: 'main' }] });
const leaf = (s: S, p: CirclePose) => s.add({ kind: 'leaf', layer: 'main', pose: p, data: {} });
const deps = (s: S, ids: NodeId[]) => ({
  selection: { get: () => ids, set: () => {} },
  scene: s as Scene<unknown, string, unknown>,
  poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
});
const run = (action: { invoker?: unknown }, d: object, params?: object) =>
  (action.invoker as ImmediateInvoker).run(d as never, params as never);

describe('built-in actions read the poseDescriptor dep', () => {
  it('flip leaves a symmetric circle where it is', () => {
    const s = scene(); const a = leaf(s, circle(10, 10, 5));
    run(flipAction, deps(s, [a]), { axis: 'x' });
    expect(s.get(a)!.pose).toEqual(circle(10, 10, 5));
  });

  it('nudge moves a circle', () => {
    const s = scene(); const a = leaf(s, circle(10, 10, 5));
    run(nudgeRightAction, deps(s, [a]));
    expect(s.get(a)!.pose.cy).toBe(10);
    expect(s.get(a)!.pose.cx).toBeGreaterThan(10);
    expect(Object.keys(s.get(a)!.pose).sort()).toEqual(['cx', 'cy', 'r']);
  });

  it('align-left lines circles up on their left edges', () => {
    const s = scene(); const a = leaf(s, circle(10, 0, 5)); const b = leaf(s, circle(50, 40, 10));
    run(alignLeftAction, deps(s, [a, b]));
    expect(s.get(b)!.pose).toEqual(circle(15, 40, 10));
  });

  it('distribute spaces three circles evenly', () => {
    const s = scene();
    const a = leaf(s, circle(0, 0, 5)); const b = leaf(s, circle(20, 0, 5)); const c = leaf(s, circle(100, 0, 5));
    run(distributeHorizontalAction, deps(s, [a, b, c]));
    expect(s.get(b)!.pose).toEqual(circle(50, 0, 5));
  });

  it('duplicate offsets a circle through its descriptor', () => {
    const s = scene(); const a = leaf(s, circle(10, 10, 5));
    const d = deps(s, [a]);
    run(duplicateAction, d);
    const copy = [...s.nodes.values()].find((n) => n.id !== a)!;
    expect(Object.keys(copy.pose).sort()).toEqual(['cx', 'cy', 'r']);
    expect(Number.isFinite(copy.pose.cx)).toBe(true);
  });

  it('rotate leaves a pose that cannot rotate untouched', () => {
    const s = scene(); const a = leaf(s, circle(10, 10, 5));
    const invoker = rotateAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = { world: { x: 30, y: 10 }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps: deps(s, [a]) };
    const h = invoker.start(base as InvocationCtx, undefined);
    // After the fix a non-rotatable selection gets an empty handle.
    h.onMove?.({ ...base, world: { x: 10, y: 30 } } as InvocationCtx);
    h.onEnd?.({ ...base, world: { x: 10, y: 30 } } as InvocationCtx, 'commit');
    expect(s.get(a)!.pose).toEqual(circle(10, 10, 5));
  });

  it('clone translates a circle', () => {
    const s = scene(); const a = leaf(s, circle(10, 10, 5));
    const invoker = cloneAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = { world: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
      modifiers: { alt: true, ctrl: false, meta: false, shift: false }, deps: deps(s, [a]) };
    const dragCtx = { start: { x: 0, y: 0 }, current: { x: 20, y: 0 }, delta: { x: 20, y: 0 } };
    const h = invoker.start(base as InvocationCtx, undefined);
    h.onMove!({ ...base, drag: dragCtx } as InvocationCtx);
    h.onEnd!({ ...base, drag: dragCtx } as InvocationCtx, 'commit');
    const copy = [...s.nodes.values()].find((n) => n.id !== a)!;
    expect(copy.pose).toEqual(circle(30, 10, 5));
  });
});
```

Before running, check each imported name against the module: the nudge and distribute export names, whether `duplicateAction`'s `run` reads `params`, and whether `cloneAction` needs an `applyOps` dep or a params flag to commit. Adjust the calls to the real signatures; do not change the assertions.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project=core packages/core/src/interactions/actions/defaults/descriptorActions.test.ts`
Expected: FAIL. Each failure should come from a rect assumption: NaN or extra `x`/`y`/`width`/`height` keys (flip, nudge, align, distribute, duplicate, clone), or a `rotation` key written onto the circle (rotate). A "read deps.poseDescriptor but did not declare it" throw is also an acceptable failure for this step.

- [ ] **Step 3: Rotate**

In `packages/core/src/interactions/actions/defaults/rotate.ts`:
- `requires: ['selection', 'scene', 'applyOps', 'poseDescriptor'],`
- Delete `getPoseRect`. Replace `applyRotationDelta` with:

```ts
function applyRotationDelta(
  d: PoseDescriptor<unknown>,
  pose: unknown,
  originRotation: number,
  delta: number,
  originCenter: { x: number; y: number },
  unionCenter: { x: number; y: number },
  useUnionPivot: boolean,
): unknown {
  const rotated = d.withRotation!(pose, originRotation + delta);
  if (!useUnionPivot) return rotated;
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  const ox = originCenter.x - unionCenter.x;
  const oy = originCenter.y - unionCenter.y;
  const nx = unionCenter.x + ox * cos - oy * sin;
  const ny = unionCenter.y + ox * sin + oy * cos;
  return translatePoseViaDescriptor(rotated, nx - originCenter.x, ny - originCenter.y, d);
}
```

- Add `descriptor: PoseDescriptor<unknown>;` to `RotateScratch`.
- In `start`, replace the capture loop and union with:

```ts
      const descriptor = poseDescriptorOf(ctx.deps.poseDescriptor);
      const originPoses = new Map<NodeId, unknown>();
      const originCenters = new Map<NodeId, { x: number; y: number }>();
      const originRotations = new Map<NodeId, number>();
      const visual: Bounds[] = [];

      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        if (!descriptor.withRotation || descriptor.supportsRotation?.(node.pose) === false) continue;
        const b = descriptor.getBounds(node.pose);
        originPoses.set(id, node.pose);
        originCenters.set(id, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
        originRotations.set(id, descriptor.getRotation?.(node.pose) ?? 0);
        visual.push(visualBoundsViaDescriptor(node.pose, descriptor));
      }

      if (originPoses.size === 0) return {};

      const union = unionAABB(visual)!;
```

  and add `descriptor,` to the scratch literal, and pass `scratch.descriptor` as the first argument of `applyRotationDelta` in `recomputePreviews`. `recomputePreviews` iterates `scratch.ids`; change it to iterate `scratch.originPoses.keys()` so skipped ids are not previewed.
- Imports: `poseDescriptorOf` from `'../poseDescriptorDep'`; `translatePoseViaDescriptor, visualBoundsViaDescriptor, type PoseDescriptor` from `'../resize/geometry'`; `type Bounds` from `'core/viewport/fitViewToBounds'`; drop `type RectPose`.
- Header doc: replace the "Assumes rect-shaped poses…" bullet with "Reads and writes poses through the `poseDescriptor` dep; a pose whose descriptor has no `withRotation`, or reports `supportsRotation` false, is left alone." Delete the `RotateGeometry` sentences.

- [ ] **Step 4: Flip**

`packages/core/src/interactions/actions/defaults/flip.ts`:
- `requires: ['selection', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor'],`
- `run` passes `poseDescriptorOf(deps.poseDescriptor)` as a new last argument to `flipSelection`; `flipSelection` takes `geom: PoseDescriptor<unknown>` as that parameter and the line `const geom = AUTO_POSE_DESCRIPTOR as unknown as PoseDescriptor<unknown>;` is deleted. Update the doc "using the kit's default rect geometry" → "using the `poseDescriptor` dep".

`packages/core/src/interactions/actions/flip/helpers.ts`, replace `negateRotation`:

```ts
function negateRotation<TPose>(pose: TPose, rotation: number, geometry: PoseDescriptor<TPose>): TPose {
  if (rotation === 0) return pose;
  return geometry.withRotation ? geometry.withRotation(pose, -rotation) : pose;
}
```

and its call: `return negateRotation(normalizeNegativeExtent(next), rotation, geometry);`. Delete the doc sentence "`PoseDescriptor` reads rotation but has no writer…".

- [ ] **Step 5: Nudge, align, distribute**

`nudge.ts`: add `'poseDescriptor'` to `requires`; pass `poseDescriptorOf(deps.poseDescriptor)` into `nudgeSelection` as a new last parameter `d: PoseDescriptor<unknown>`; replace `const translate = (AUTO_POSE_DESCRIPTOR as PoseDescriptor<unknown>).translate!;` and its call with `translatePoseViaDescriptor(node.pose, dx, dy, d)`.

`align.tsx`: `requires: ['selection', 'scene', 'poseDescriptor'],`; `alignSelection(selection, scene, edge, geom)` takes the descriptor, and `run` passes `poseDescriptorOf(deps.poseDescriptor)`; delete `const geom = RECT_POSE_DESCRIPTOR as …`; drop the `as Bounds` cast on `visualBoundsViaDescriptor`. Update the doc "Uses the kit's default rect-pose geometry…" → "Reads poses through the `poseDescriptor` dep."

`distribute.tsx`: same shape — `requires` gains `'poseDescriptor'`, `distributeSelection` takes the descriptor, the `RECT_POSE_DESCRIPTOR` line goes, the doc says it reads the dep.

`declaredDeps.test.ts` runs align/distribute with a bag that lacks `poseDescriptor`; `poseDescriptorOf(undefined)` returns AUTO, so it must keep passing.

- [ ] **Step 6: Clone and duplicate**

`clone.ts`: add `'poseDescriptor'` to `requires`; capture `const descriptor = poseDescriptorOf(ctx.deps.poseDescriptor);` in `start` and store it on the scratch; delete the private `translatePose` and replace its two calls (lines ~162, ~189) with `translatePoseViaDescriptor(origin, dx, dy, scratch.descriptor)`.

`duplicate.ts`: add `'poseDescriptor'` to `requires`; delete the private `translatePose`; thread `poseDescriptorOf(deps.poseDescriptor)` into the function that builds copies and use `translatePoseViaDescriptor(node.pose, offset.dx, offset.dy, d)` at line ~60.

- [ ] **Step 7: Run**

```bash
npx vitest run --project=core packages/core/src/interactions/actions/defaults
npx vitest run --project=core packages/core/src/interactions/actions/flip packages/core/src/interactions/actions/align packages/core/src/interactions/actions/distribute
```

Expected: PASS, including the existing flip/align/distribute/rotate/nudge/clone/duplicate/declaredDeps tests. If an existing rotate test now fails, read why before touching it: a test whose poses are rects must still pass unchanged.

- [ ] **Step 8: Typecheck and commit**

Run: `npx tsc --noEmit` — exit 0.

```bash
git add packages/core/src/interactions/actions/defaults/descriptorActions.test.ts
git add -u packages/core/src/interactions/actions
git commit -m "read the pose descriptor in rotate, flip, nudge, align, distribute, clone and duplicate"
```

---

### Task 7: Group and `unionOfChildren`

**Files:**
- Modify: `packages/core/src/core/scene/kitRegistry.ts`, `scene.ts`, `types.ts`, `index.ts`
- Modify: `packages/core/src/interactions/actions/defaults/group.ts`
- Test: `packages/core/src/core/scene/derivedPose.test.ts`, `packages/core/src/interactions/actions/defaults/group.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/core/scene/derivedPose.test.ts`:

```ts
describe('derived pose — non-rect poses', () => {
  it('unions circles through a descriptor', () => {
    const union = unionOfChildrenVia(CIRCLE_POSE_DESCRIPTOR);
    const scene = createScene<object, 'main', CirclePose>({
      systemLayers: LAYERS,
      registry: { derivePose: { [UNION_OF_CHILDREN]: union } },
    });
    const g = scene.add({
      kind: 'container', layer: 'main', pose: circle(0, 0, 0), data: {},
      dependsOn: 'children', derivePose: union,
    });
    scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: circle(0, 0, 10), data: {} });
    scene.add({ kind: 'leaf', parent: g, layer: 'main', pose: circle(40, 0, 10), data: {} });
    expect(effectivePose(scene, scene.get(g)!)).toEqual(circle(20, 0, 10));
  });

  it('exposes the merged registry', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    expect(scene.registry.derivePose?.[UNION_OF_CHILDREN]).toBe(unionOfChildren);
  });
});
```

(imports: `unionOfChildrenVia` from `'./kitRegistry'`; `circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose` from `'core/testkit/circlePose'`.)

Append to `packages/core/src/interactions/actions/defaults/group.test.ts`:

```ts
describe('groupAction — non-rect poses', () => {
  it('groups circles into a circle-posed container that survives toJSON', () => {
    const union = unionOfChildrenVia(CIRCLE_POSE_DESCRIPTOR);
    const scene = createScene<object, 'main', CirclePose>({
      systemLayers: [{ id: 'main' }],
      registry: { derivePose: { [UNION_OF_CHILDREN]: union } },
    });
    const a = scene.add({ kind: 'leaf', layer: 'main', pose: circle(0, 0, 10), data: {} });
    const b = scene.add({ kind: 'leaf', layer: 'main', pose: circle(40, 0, 10), data: {} });
    const selection = makeSelection([a, b]);
    (groupAction.invoker as ImmediateInvoker).run(
      { scene, selection, poseDescriptor: CIRCLE_POSE_DESCRIPTOR } as never,
      undefined as never,
    );
    const g = selection.get()[0]!;
    expect(scene.get(g)!.pose).toEqual(circle(20, 0, 10));
    expect(() => scene.toJSON()).not.toThrow();
  });
});
```

(imports: `unionOfChildrenVia, UNION_OF_CHILDREN` from `'core/scene/kitRegistry'`; the circle fixture.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project=core packages/core/src/core/scene/derivedPose.test.ts packages/core/src/interactions/actions/defaults/group.test.ts`
Expected: FAIL — `unionOfChildrenVia` is not exported; `scene.registry` is undefined.

- [ ] **Step 3: `unionOfChildrenVia` and the kit default**

Replace the body of `packages/core/src/core/scene/kitRegistry.ts` below the header doc with:

```ts
import type { SceneRegistry } from './types';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { visualBoundsViaDescriptor } from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import { unionAABB } from '../geometry/unionBounds';

/** Registry key for {@link unionOfChildren}. */
export const UNION_OF_CHILDREN = 'kit:unionOfChildren';

type DerivePose<TPose> = (
  node: { pose: TPose },
  deps: readonly ({ pose: TPose } | undefined)[],
) => TPose | null;

/**
 * A container's pose as the envelope of what it holds, read through
 * `descriptor` — a rotated member contributes the extent of its ink. Returns
 * `null` for an emptied container, which then keeps its authored pose.
 */
export function unionOfChildrenVia<TPose>(descriptor: PoseDescriptor<TPose>): DerivePose<TPose> {
  return (node, deps) => {
    const boxes = [];
    for (const d of deps) if (d !== undefined) boxes.push(visualBoundsViaDescriptor(d.pose, descriptor));
    const u = unionAABB(boxes);
    return u === null ? null : descriptor.fromBounds(u, node.pose);
  };
}

const autoUnion = unionOfChildrenVia<unknown>(AUTO_POSE_DESCRIPTOR);

/** The kit's union, over `AUTO_POSE_DESCRIPTOR` (rect and `Path` poses). A
 *  scene with another pose kind registers its own under `UNION_OF_CHILDREN`.
 *  One function instance: the registry serializes it by identity. */
export function unionOfChildren<TPose>(
  node: { pose: TPose },
  deps: readonly ({ pose: TPose } | undefined)[],
): TPose | null {
  return autoUnion(node, deps) as TPose | null;
}

/** Merge the kit's own entries under a consumer registry. */
export function withKitRegistry<TPose>(registry: SceneRegistry<TPose>): SceneRegistry<TPose> {
  return {
    ...registry,
    derivePose: {
      [UNION_OF_CHILDREN]: unionOfChildren as NonNullable<
        SceneRegistry<TPose>['derivePose']
      >[string],
      ...registry.derivePose,
    },
  };
}
```

Keep the existing file header doc. Check `unionAABB`'s signature (`core/geometry/unionBounds.ts:87`) accepts `Bounds[]`; if it requires `RectPose`, `Bounds` satisfies it structurally.

**Behavior check:** for rect poses the old union returned `unionAABB(poses)`; the new one returns `RECT fromBounds(unionAABB(visual boxes))` — the same four fields, since `visualBoundsViaDescriptor` equals `axisAlignedBounds` for a rect. For rect-Path containers it now returns a rect `Path` instead of a plain rect. The existing `derivedPose.test.ts` cases must pass unchanged.

If this import produces a circular-import error at test time (`Cannot access … before initialization`), stop and report the cycle path rather than reshuffling modules.

- [ ] **Step 4: `Scene.registry`**

In `packages/core/src/core/scene/types.ts`, add to `interface Scene` right after `readonly layers`:

```ts
  /** The registry this scene resolves node functions against — the consumer's
   *  entries over the kit's. */
  readonly registry: SceneRegistry<TPose>;
```

In `packages/core/src/core/scene/scene.ts`, in the `const scene: Scene<TData, TLayer, TPose> = {` literal (line ~950), add after `get layers()`:

```ts
    registry,
```

Export `unionOfChildrenVia` next to `unionOfChildren` in `packages/core/src/core/scene/index.ts` and `packages/core/src/index.ts` (line ~846).

- [ ] **Step 5: The group action**

In `packages/core/src/interactions/actions/defaults/group.ts`:
- `requires: ['scene', 'selection', 'applyOps', 'poseDescriptor'],`
- Replace the pose line (line ~70–71):

```ts
      // The authored pose is only the fallback (an emptied group, a lost
      // registry key); the derived union is what the scene shows.
      const d = poseDescriptorOf(deps.poseDescriptor);
      const frame = unionBounds(nodes.map((n) => d.getBounds(n.pose)));
      const pose = frame === null ? nodes[0]!.pose : d.fromBounds(frame, nodes[0]!.pose);
      const derive = scene.registry.derivePose?.[UNION_OF_CHILDREN] ?? unionOfChildren;
```

  `unionBounds` ignores rotation, exactly as the old line did, so a rect group's authored pose is unchanged.
- In the insert op's node, `derivePose: unionOfChildren,` becomes `derivePose: derive,`.
- Imports: keep `unionBounds` from `'core/geometry/unionBounds'`, drop `type RectPose`; `unionOfChildren, UNION_OF_CHILDREN` from `'core/scene/kitRegistry'`; `poseDescriptorOf` from `'../poseDescriptorDep'`.

- [ ] **Step 6: Run**

```bash
npx vitest run --project=core packages/core/src/core/scene packages/core/src/interactions/actions/defaults/group.test.ts packages/core/src/interactions/actions/buildDeps.test.ts
```

Expected: PASS — including `buildDeps.test.ts`, whose `poseDescriptor` assertions now hold for every listed action.

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit` — exit 0. Test stubs that build a fake `Scene` object with `as` casts compile unchanged; a stub typed `: Scene<…>` without a cast needs `registry: {}` added.

```bash
git add -u packages/core/src
git commit -m "union group bounds through the pose descriptor and expose Scene.registry"
```

---

### Task 8: Picking, cascades, area select and the adapters

**Files:**
- Modify: `packages/core/src/canvas/SceneCanvas/poseGeometry.ts`, `useSceneSelectTool.ts`
- Modify: `packages/core/src/canvas/sceneAdapter.ts`, `packages/core/src/core/adapters/arrayAdapter.ts`, `useArrayAdapter.ts`
- Modify: `packages/core/src/canvas/deps/{hitTestArea,areaSelect,lassoSelect}.ts`
- Modify: `packages/core/src/canvas/SceneCanvas.tsx`
- Test: `packages/core/src/canvas/SceneCanvas/useSceneSelectTool.descriptor.test.tsx` (new), `packages/core/src/canvas/sceneAdapter.test.ts`, `packages/core/src/core/adapters/arrayAdapter.test.ts`, `packages/core/src/canvas/deps/hitTestArea.test.ts`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/core/src/canvas/SceneCanvas/useSceneSelectTool.descriptor.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScene } from 'core/scene/useScene';
import { useSelection } from 'core/selection/useSelection';
import { asNodeId } from 'core/scene/types';
import { useSceneSelectTool } from './useSceneSelectTool';
import { circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose } from 'core/testkit/circlePose';

function harness() {
  return renderHook(() => {
    const scene = useScene<object, 'default', CirclePose>({ systemLayers: [{ id: 'default' }] });
    const selection = useSelection({ mode: 'single' });
    return {
      scene,
      // 'pose' picking isolates the pose pre-filter from the painter stage.
      tool: useSceneSelectTool({
        scene, selection, poseDescriptor: CIRCLE_POSE_DESCRIPTOR, geometry: { picking: 'pose' },
      }),
    };
  });
}

describe('useSceneSelectTool — non-rect poses', () => {
  it('reports a circle’s bounds', () => {
    const { result } = harness();
    let id = '';
    act(() => { id = result.current.scene.add({ kind: 'leaf', layer: 'default', pose: circle(10, 10, 5), data: {} }); });
    expect(result.current.tool.boundsOf(id)).toEqual({ x: 5, y: 5, width: 10, height: 10 });
  });

  it('picks a circle inside its bounds', () => {
    const { result } = harness();
    let id = '';
    act(() => { id = result.current.scene.add({ kind: 'leaf', layer: 'default', pose: circle(10, 10, 5), data: {} }); });
    expect(result.current.tool.pickEvery(10, 10)).toEqual([id]);
  });

  it('cascades a container move to circle children', () => {
    const { result } = harness();
    let box = ''; let kid = '';
    act(() => {
      box = result.current.scene.add({ kind: 'container', layer: 'default', pose: circle(50, 50, 50), data: {} });
      kid = result.current.scene.add({ kind: 'leaf', layer: 'default', parent: asNodeId(box), pose: circle(40, 40, 5), data: {} });
    });
    act(() => { result.current.tool.adapter.setPose(box, circle(60, 50, 50)); });
    expect(result.current.scene.get(asNodeId(kid))!.pose).toEqual(circle(50, 40, 5));
  });
});
```

Check `useScene`'s and `useSelection`'s import paths against `useSceneSelectTool.picking.test.tsx` and copy them exactly.

Append to `packages/core/src/canvas/sceneAdapter.test.ts`:

```ts
describe('sceneToAdapter — non-rect poses', () => {
  it('area-selects and pastes circles through the descriptor', () => {
    const scene = createScene<object, 'bg', CirclePose>({ systemLayers: [{ id: 'bg' }] });
    const id = scene.add({ kind: 'leaf', layer: 'bg', pose: circle(10, 10, 5), data: {} });
    const adapter = sceneToAdapter(scene, { poseDescriptor: CIRCLE_POSE_DESCRIPTOR });
    expect(adapter.hitTestArea({ x: 0, y: 0, width: 20, height: 20 })).toEqual([id]);
    const pasted = adapter.commitPaste(adapter.snapshotSelection([id]), { dx: 7, dy: 0 });
    expect(pasted[0]!.pose).toEqual(circle(17, 10, 5));
  });

  it('cascades a container move to circle children', () => {
    const scene = createScene<object, 'bg', CirclePose>({ systemLayers: [{ id: 'bg' }] });
    const box = scene.add({ kind: 'container', layer: 'bg', pose: circle(50, 50, 50), data: {} });
    const kid = scene.add({ kind: 'leaf', layer: 'bg', parent: box, pose: circle(40, 40, 5), data: {} });
    const adapter = sceneToAdapter(scene, { poseDescriptor: CIRCLE_POSE_DESCRIPTOR, cascadeContainerPose: true });
    adapter.setPose(box, circle(60, 50, 50));
    expect(scene.get(kid)!.pose).toEqual(circle(50, 40, 5));
  });
});
```

Append to `packages/core/src/core/adapters/arrayAdapter.test.ts` (copy the file's existing `ref`/`setItems` setup; the node shape there is `{ id, ...pose }` with `toPose`/`fromPose` — build an equivalent circle item list):

```ts
describe('arrayAdapter — non-rect poses', () => {
  it('area-selects a circle through the descriptor', () => {
    type C = { id: string } & CirclePose;
    const items: C[] = [{ id: 'a', ...circle(10, 10, 5) }];
    const ref = { current: items };
    const adapter = arrayAdapter<C, CirclePose>({
      ref, setItems: () => {},
      toPose: (n) => ({ cx: n.cx, cy: n.cy, r: n.r }),
      fromPose: (n, p) => ({ ...n, ...p }),
      poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
    });
    expect(adapter.hitTestArea({ x: 0, y: 0, width: 20, height: 20 })).toEqual(['a']);
    expect(adapter.hitTestArea({ x: 30, y: 30, width: 5, height: 5 })).toEqual([]);
  });
});
```

(Match the real `ArrayAdapterConfig` field names — read lines 1–70 of `arrayAdapter.ts` first.)

Append to `packages/core/src/canvas/deps/hitTestArea.test.ts`:

```ts
it('fast-rejects and admits circles through a descriptor', () => {
  const scene = createScene<object, 'main', CirclePose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'leaf', layer: 'main', pose: circle(10, 10, 5), data: {} });
  const s = scene as unknown as Scene<unknown, string, unknown>;
  expect(hitTestArea(s, { x: 0, y: 0, width: 20, height: 20 }, undefined, CIRCLE_POSE_DESCRIPTOR as never)).toEqual([id]);
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
npx vitest run --project=core packages/core/src/canvas/SceneCanvas/useSceneSelectTool.descriptor.test.tsx packages/core/src/canvas/sceneAdapter.test.ts packages/core/src/core/adapters/arrayAdapter.test.ts packages/core/src/canvas/deps/hitTestArea.test.ts
```

Expected: FAIL — TypeScript/vitest reports unknown option `poseDescriptor`, or bounds come back `NaN`, or the cascade leaves the child untouched.

- [ ] **Step 3: `poseGeometry.ts`**

In `packages/core/src/canvas/SceneCanvas/poseGeometry.ts`:
- Delete the local `isPathLike` and import it from `'interactions/actions/resize/autoPoseDescriptor'`.
- `aabbOfPose` becomes:

```ts
export function aabbOfPose<TPose>(
  pose: TPose,
  descriptor: PoseDescriptor<unknown> = AUTO_POSE_DESCRIPTOR,
): Bounds {
  return descriptor.getBounds(pose);
}
```

- `poseContains` and `poseContainsRotated` gain the same trailing `descriptor` parameter (default `AUTO_POSE_DESCRIPTOR`) and pass it to `aabbOfPose`. `poseContainsRotated` reads rotation with `poseRotationOf(pose)`; when a non-default descriptor is passed, use `descriptor.getRotation?.(pose) ?? 0` and the center of `descriptor.getBounds(pose)` instead. Keep the path branch (`isPathLike` → `pointInPath`/`strokeHitTest`) first in both.
- Update the file header to say it reads through a descriptor, defaulting to AUTO.

- [ ] **Step 4: `hitTestArea.ts`, `areaSelect.ts`, `lassoSelect.ts`**

`hitTestArea(scene, bounds, opts?, descriptor = AUTO_POSE_DESCRIPTOR)` and `hitTestAreaPolygon(scene, area, areaBounds?, areaIsRect = false, opts?, descriptor = AUTO_POSE_DESCRIPTOR)`; pass it down. Inside `hits`, replace both `aabbOfPose(pose)` calls with `aabbOfPose(pose, descriptor)`, and in `clipAdmits` replace `axisAlignedBounds(aabbOfPose(pose))` with `visualBoundsViaDescriptor(pose, descriptor)`. The `nodeMemo(... 'aabb' ...)` key stays — the memo is per node and per pose, and one scene has one descriptor.

`useAreaSelectDepSource(scene, selection, descriptor?)` and `useLassoSelectDepSource(scene, selection, descriptor?)` take a trailing optional descriptor and pass it to the hit test. In `SceneCanvas.tsx`'s `StandardActionsRegistrar`, pass `poseDescriptor` to both.

- [ ] **Step 5: `useSceneSelectTool.ts`**

- Add to `UseSceneSelectToolArgs`: `poseDescriptor?: PoseDescriptor<TPose>;` and destructure it; `const d = (args.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;`.
- `sceneToAdapter(scene, { commitInsert, insertLayer, layouts, poseDescriptor: d })` and add `d` to the memo deps.
- The cascade (lines ~167–185):

```ts
        const prev = d.getBounds(n.pose);
        const next = d.getBounds(pose);
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        …
          for (const cid of desc) {
            const cn = scene.get(asNodeId(cid));
            if (!cn) continue;
            base.setPose(cid, translatePoseViaDescriptor(cn.pose, dx, dy, d));
          }
```

  Delete the "Container cascade is rect-only" comment and the `translateRectPose`/`RectPose` imports if unused.
- `wiredHitBody`: pass `d as PoseDescriptor<unknown>` as the trailing argument of `poseContains` and `poseContainsRotated`; add `d` to the memo deps.
- `wiredBoundsOf` (lines ~265–280):

```ts
      const pose = adapter.getPose(id);
      const b = d.getBounds(pose);
      const rot = d.getRotation?.(pose) ?? (b as { rotation?: number }).rotation ?? 0;
      return rot ? { ...b, rotation: rot } : b;
```

  Delete the stale comment about `selectTool.resize.geometry`. Add `d` to the deps.
- In `SceneCanvas.tsx`, pass `poseDescriptor: descriptor as PoseDescriptor<TPose>` in the `useSceneSelectTool({…})` call (line ~1228).

- [ ] **Step 6: `sceneAdapter.ts`**

- `SceneToAdapterOptions`: delete `poseBounds?`; add

```ts
  /** How to read and rewrite this scene's poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
```

  and change `cascadeContainerPose` to `cascadeContainerPose?: boolean;` with doc: "When true, `setPose` on a container translates every descendant by the same delta, through the pose descriptor. Scene v1 stores absolute poses, so without it children stay behind."
- In `sceneToAdapter`:

```ts
  const d = (options.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const poseBounds = (p: TPose): Bounds => visualBoundsViaDescriptor(p, d);
  const translate = (p: TPose, dx: number, dy: number): TPose => translatePoseViaDescriptor(p, dx, dy, d);
```

  replacing the old `poseBounds` default and `cascadeTranslate`; delete `pasteTranslatePose` and use `translate` in `commitPaste`; the setPose cascade becomes `if (options.cascadeContainerPose) { … const before = d.getBounds(node.pose); const after = d.getBounds(pose); const dx = after.x - before.x; const dy = after.y - before.y; … scene.setPose(asNodeId(cid), translate(cn.pose, dx, dy)); }`.
- `useSceneAdapter`: destructure `poseDescriptor` instead of `poseBounds` and forward it; update its memo deps.
- `sceneAdapter.test.ts:483`'s test ("No cascadeContainerPose translator and no top-level x/y") asserted an untranslated paste with a dwarn for a pose AUTO cannot read. Under the descriptor that pose goes through AUTO's rect translate. Rewrite that test to pass `poseDescriptor` for its pose kind and assert the translated result, or delete it if the pose it uses has no sensible descriptor — say which in the commit body.

- [ ] **Step 7: `arrayAdapter.ts`**

- Delete the `poseBounds`, `intersectsRect` and `translatePose` config members, `defaultPoseBounds` and `defaultTranslatePose`; add `poseDescriptor?: PoseDescriptor<TPose>;` (doc: "How to read and rewrite item poses. Default `AUTO_POSE_DESCRIPTOR`.").
- In the body, `const d = (config.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;`
- `hitTestArea`: `const hit = d.intersectsRect ? d.intersectsRect(pose, rect) : aabbIntersectsRect(d.getBounds(pose), rect);`
- `hitTestLasso` and `commitPaste`'s drop-point: `d.getBounds(...)`.
- `commitPaste` translate: `translatePoseViaDescriptor(toPose(cloned), dx, dy, d)`.
- `arrayAdapter.test.ts:23,79` and `insertIndex.test.ts:17` pass `poseBounds: (p) => p` — delete that option from each call.

- [ ] **Step 8: Run**

```bash
npx vitest run --project=core packages/core/src/canvas/SceneCanvas packages/core/src/canvas/sceneAdapter.test.ts packages/core/src/core/adapters packages/core/src/canvas/deps
```

Expected: PASS.

- [ ] **Step 9: Typecheck and commit**

Run: `npx tsc --noEmit` — exit 0.

```bash
git add packages/core/src/canvas/SceneCanvas/useSceneSelectTool.descriptor.test.tsx
git add -u packages/core/src
git commit -m "read the pose descriptor in picking, area select, both cascades and both adapters"
```

---

### Task 9: Overlay, minimap, nested hits, `useSelectTool`

**Files:**
- Modify: `packages/core/src/features/selection/overlay.ts`, `packages/core/src/canvas/Canvas.tsx`, `SceneCanvas.tsx`
- Modify: `packages/core/src/canvas/minimapMath.ts`, `MinimapCanvas.tsx`
- Modify: `packages/core/src/features/groups/nestedHit.ts`
- Modify: `packages/core/src/tools/builtin/select/useSelectTool.ts`
- Test: `overlay.test.ts`, `minimapMath.test.ts`, `MinimapCanvas.test.tsx`, `nestedHit.test.ts`, `useSelectTool.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/features/selection/overlay.test.ts`:

```ts
describe('composeSelectionPose — non-rect poses', () => {
  it('collapses a circle container to a circle through the descriptor', () => {
    const poses: Record<string, CirclePose> = { a: circle(0, 0, 10), b: circle(40, 0, 10) };
    const resolve = composeSelectionPose<CirclePose>({
      getStoredPose: (id) => poses[id]!,
      getChildren: (id) => (id === 'g' ? ['a', 'b'] : []),
      isContainer: (id) => id === 'g',
      poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
    });
    expect(resolve('g')).toEqual(circle(20, 0, 10));
  });
});
```

Replace the test at `packages/core/src/features/groups/nestedHit.test.ts:75` ("uses provided poseBounds for non-rect poses") so it passes `poseDescriptor: CIRCLE_POSE_DESCRIPTOR` and its circle poses use `{cx, cy, r}` from the fixture; keep its assertions.

Append to `packages/core/src/canvas/minimapMath.test.ts`:

```ts
it('frames circles through the descriptor', () => {
  const scene = createScene<object, 'main', CirclePose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'leaf', layer: 'main', pose: circle(50, 50, 50), data: {} });
  const view = computeFitView(scene, { width: 100, height: 100 }, 'scene', CIRCLE_POSE_DESCRIPTOR);
  expect(Number.isFinite(view.x) && Number.isFinite(view.scale.x)).toBe(true);
});
```

Create `packages/core/src/tools/builtin/select/useSelectTool.descriptor.test.tsx` (same harness shape as `useSelectTool.leafPicking.test.tsx`):

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { useScene } from 'core/scene/useScene';
import { useSelection } from 'core/selection/useSelection';
import { asNodeId } from 'core/scene/types';
import { useSelectTool } from './useSelectTool';
import type { Action } from '../../../interactions/actions/registry';
import type { ActionDeps } from '../../../interactions/actions/invoker';
import { circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose } from 'core/testkit/circlePose';

describe('useSelectTool — default pickEvery reads the descriptor', () => {
  it('selects a circle pressed at its center', () => {
    const { result } = renderHook(() => {
      const scene = useScene<object, 'default', CirclePose>({
        systemLayers: [{ id: 'default' }],
        initial: [{ id: asNodeId('c'), kind: 'leaf', layer: 'default', pose: circle(50, 50, 10), data: {} }],
      });
      const sel = useSelection({ mode: 'single' });
      const adapter = sceneToAdapter(scene, { selection: sel, poseDescriptor: CIRCLE_POSE_DESCRIPTOR });
      return { tool: useSelectTool(adapter as never, { poseDescriptor: CIRCLE_POSE_DESCRIPTOR } as never), sel };
    });
    const invoker = (result.current.tool as { actions?: readonly Action[] })
      .actions?.find((a) => a.id === 'select.pick')?.invoker;
    if (invoker?.timing !== 'immediate') throw new Error('select.pick missing');
    act(() => {
      invoker.run({ selection: result.current.sel } as unknown as ActionDeps, {
        worldX: 50, worldY: 50, mods: { alt: false, ctrl: false, meta: false, shift: false },
      });
    });
    expect(result.current.sel.current).toEqual(['c']);
  });
});
```

(Task 8 adds `poseDescriptor` to `sceneToAdapter`; this task adds it to `useSelectTool`.)

- [ ] **Step 2: Run them to verify they fail**

```bash
npx vitest run --project=core packages/core/src/features/selection/overlay.test.ts packages/core/src/features/groups/nestedHit.test.ts packages/core/src/canvas/minimapMath.test.ts packages/core/src/tools/builtin/select/useSelectTool.descriptor.test.tsx
```

Expected: FAIL on the unknown `poseDescriptor` option / argument type, or on `NaN`.

- [ ] **Step 3: The overlay**

In `packages/core/src/features/selection/overlay.ts`:
- `ComposeSelectionPoseOpts`: delete `getBounds?` and `fromBounds?` (with docs); add `poseDescriptor?: PoseDescriptor<TPose>;` ("How to read poses. Default `AUTO_POSE_DESCRIPTOR`.").
- `composeSelectionPose`: `const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;` Leaf bounds use `visualBoundsViaDescriptor(pose, d)`; the result is `d.fromBounds(u, getStoredPose(leaves[0]!))`.
- `makeContainerAwareBoundsResolver(getPose, d, getChildren?, isContainer?)`: for a single id return the oriented bounds

```ts
const oriented = (p: TPose): Bounds => {
  const b = d.getBounds(p);
  const r = d.getRotation?.(p);
  return r ? { ...b, rotation: r } : b;
};
```

  and for a container the union of `visualBoundsViaDescriptor` over its leaves.
- `SelectionLayerCommon`: replace `getBounds?` with `poseDescriptor?: PoseDescriptor<TPose>;`; `buildSelectionLayer` resolves `d` the same way and passes it.
- Update the module header (lines ~19–23): "callers pass `poseDescriptor` for poses AUTO can't read."

In `Canvas.tsx` (line ~1271) the `…(cfg.poseById ? { getPose: cfg.poseById, getBounds: … } : {})` spread becomes `…(cfg.poseById ? { getPose: cfg.poseById, poseDescriptor: cfg.poseDescriptor ?? geometry } : {})`. In `SceneCanvas.tsx` (line ~1851) likewise with `descriptor as PoseDescriptor<TPose>`. `overlay.test.ts:107-108,126-127` pass `getBounds`/`fromBounds` identities — delete those two lines in each call.

- [ ] **Step 4: Minimap**

`minimapMath.ts`: `computeFitView(scene, dims, fit, descriptor: PoseDescriptor<TPose>, opts = {})` and `sceneLeafBounds(scene, descriptor)` reads `descriptor.getBounds(documentPose(scene, node))`. Update the two doc mentions of `poseBounds`.

`MinimapCanvas.tsx`: replace the `poseBounds?` prop with `poseDescriptor?: PoseDescriptor<TPose>;` ("How to read poses. Default `AUTO_POSE_DESCRIPTOR`."), delete `IDENTITY_POSE_BOUNDS`, and compute `const descriptor = (poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;` for `computeFitView`.

Tests: in `minimapMath.test.ts` and `MinimapCanvas.test.tsx`, replace `const identityPoseBounds = …` with `const identityPoseBounds = RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<P>;` (keeping the name so the 17 call sites need no edit), and replace the two inline `(p: P) => ({…}) as Bounds` arguments (`MinimapCanvas.test.tsx:458-461,469-472`) with `identityPoseBounds`.

- [ ] **Step 5: Nested hits and `useSelectTool`**

`nestedHit.ts`: replace `poseBounds?` with `poseDescriptor?: PoseDescriptor<TPose>;` (doc: "How to read world poses. Default `AUTO_POSE_DESCRIPTOR`."); delete `defaultPoseBounds`; `const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;` and `const b = d.getBounds(w);`.

`useSelectTool.ts`: replace the `poseBounds?` option with `poseDescriptor?: PoseDescriptor<TPose>;` ("How to read poses for the default `pickEvery`. Default `AUTO_POSE_DESCRIPTOR`."); line ~162 becomes `const d = (options.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;` and line ~191 `const b = d.getBounds(pose);`. Fix the `pickEvery` doc (lines ~35–40) to say "using the pose descriptor".

- [ ] **Step 6: Run**

```bash
npx vitest run --project=core packages/core/src/features/selection packages/core/src/features/groups packages/core/src/canvas/minimapMath.test.ts packages/core/src/canvas/MinimapCanvas.test.tsx packages/core/src/tools/builtin/select packages/core/src/canvas/CanvasView.test.tsx packages/core/src/canvas/Canvas.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit` — exit 0.

```bash
git add packages/core/src/tools/builtin/select/useSelectTool.descriptor.test.tsx
git add -u packages/core/src
git commit -m "take a poseDescriptor in the selection overlay, minimap, nested hits and useSelectTool"
```

---

### Task 10: Alignment guides

**Files:**
- Modify: `packages/core/src/features/guides/alignment/{types,match,derive,behaviors,index}.ts`, `packages/core/src/index.ts`, `packages/core/src/features/guides/README.md`
- Test: `packages/core/src/features/guides/alignment/derive.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `derive.test.ts`:

```ts
it('derives guides from circles through a descriptor', () => {
  const guides = deriveAlignmentGuides([circle(10, 10, 5)], {
    poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
    centers: false,
  });
  expect(guides.map((g) => `${g.axis}:${g.offset}`).sort()).toEqual(['x:15', 'x:5', 'y:15', 'y:5']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project=core packages/core/src/features/guides/alignment/derive.test.ts`
Expected: FAIL — unknown option `poseDescriptor`, or `NaN` offsets.

- [ ] **Step 3: Replace the projection with the descriptor**

- `types.ts`: delete `AlignBoundsProjection`; in `DeriveAlignmentGuidesOptions`, replace `projection?` with `poseDescriptor?: PoseDescriptor<TPose>;` ("How to read each target. Pass the same descriptor `alignMoveBehavior` gets. Default `AUTO_POSE_DESCRIPTOR`."); its default type parameter becomes `TPose = Bounds`.
- `match.ts`: delete `RECT_ALIGN_PROJECTION` and its imports.
- `derive.ts`: `const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;` and `for (const t of targets) emit(visualBoundsViaDescriptor(t, d));`.
- `behaviors.ts`: `AlignMoveArgs.projection` becomes `poseDescriptor?: PoseDescriptor<TPose>;`; in `alignMoveBehavior`, `const d = …AUTO…;` and `boxes.push(visualBoundsViaDescriptor(translatePoseViaDescriptor(originPose, transform.dx, transform.dy, d), d));`.
- Remove `AlignBoundsProjection` and `RECT_ALIGN_PROJECTION` from `alignment/index.ts` and `packages/core/src/index.ts` (lines ~943, ~955). Edit `features/guides/README.md:36` to name `poseDescriptor` instead.

AUTO reads a rect pose's `rotation`, so a rotated rect still reports its ink box — `behaviors.test.ts:169-200` and `derive.test.ts:42` pin that and must pass unchanged.

- [ ] **Step 4: Run, typecheck, commit**

```bash
npx vitest run --project=core packages/core/src/features/guides
npx tsc --noEmit
git add -u packages/core/src
git commit -m "derive and match alignment guides through the pose descriptor"
```

Expected: PASS, exit 0.

---

### Task 11: Momentum

**Files:**
- Modify: `packages/core/src/animation/behaviors/momentum.ts`
- Test: `packages/core/src/animation/behaviors/momentum.test.ts` (existing; add a case)

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/animation/behaviors/momentum.test.ts` (it reuses the file's `makeClock` and `makeCtx`):

```ts
describe('momentum — non-rect poses', () => {
  it('flicks a circle through its descriptor', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const beh = momentum<CirclePose>({
      animator: result.current, threshold: 0, now: clock.now,
      poseDescriptor: CIRCLE_POSE_DESCRIPTOR,
    });
    const written: CirclePose[] = [];
    const ctx = makeCtx(circle(0, 0, 5) as never, (_id, p) => { written.push(p as never); }) as unknown as GestureContext<CirclePose>;
    beh.onStart?.(ctx);
    ctx.pointer = { worldX: 0, worldY: 0, clientX: 0, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    clock.advance(16);
    ctx.pointer = { worldX: 10, worldY: 0, clientX: 10, clientY: 0 };
    beh.onMove?.(ctx, { kind: 'translate', dx: 0, dy: 0 });
    beh.onEnd?.(ctx);
    clock.advance(16);
    expect(written.length).toBeGreaterThan(0);
    expect(Object.keys(written[0]!).sort()).toEqual(['cx', 'cy', 'r']);
    expect(written[0]!.cx).toBeGreaterThan(0);
  });
});
```

(imports: `circle, CIRCLE_POSE_DESCRIPTOR, type CirclePose` from `'core/testkit/circlePose'`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project=core packages/core/src/animation/behaviors/momentum.test.ts`
Expected: FAIL — `x`/`y` keys written onto the circle.

- [ ] **Step 3: Add the option**

In `MomentumOptions`, add:

```ts
  /** How to translate poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<unknown>;
```

In `momentum`, `const d = opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR;`. Where the tick and the commit read `start.x`/`start.y` and spread `{ ...start, x, y }`, read the start origin as `const o = d.getBounds(start)` and write `translatePoseViaDescriptor(start, nx - o.x, ny - o.y, d)`. `clampToBounds` keeps operating on the bounds origin (`o.x`, `o.y`). Delete the `RectLike & TPose` casts.

- [ ] **Step 4: Run, typecheck, commit**

```bash
npx vitest run --project=core packages/core/src/animation/behaviors
npx tsc --noEmit
git add -u packages/core/src/animation
git commit -m "translate momentum flicks through the pose descriptor"
```

---

### Task 12: Painters

**Files:**
- Modify: `packages/core/src/canvas/NodeShape.ts`, `packages/core/src/canvas/deps/editAnchors.ts`
- Test: `packages/core/src/canvas/NodeShape.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `NodeShape.test.ts`:

```ts
describe('built-in painters need a rect pose', () => {
  const circleNode = <TData>(data: TData) =>
    ({ id: 'c', kind: 'leaf', layer: 'default', pose: { cx: 0, cy: 0, r: 5 }, data, parent: null }) as never;

  it('does not hand a circle-posed text node to the text painter', () => {
    expect(findNodeShape(circleNode({ text: 'hi' }))?.id).not.toBe('kit:text');
  });

  it('does not fall back to the rect painter for a circle', () => {
    expect(findNodeShape(circleNode({}))).toBeUndefined();
  });

  it('re-matches when the same data gets a different kind of pose', () => {
    const data = { text: 'hi' };
    expect(findNodeShape(node(data))?.id).toBe('kit:text');
    expect(findNodeShape(circleNode(data))?.id).not.toBe('kit:text');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project=core packages/core/src/canvas/NodeShape.test.ts`
Expected: FAIL — `kit:text` and `kit:rect-fallback` match a circle; the third case fails on the cache (same `data` object).

- [ ] **Step 3: Gate and re-key**

In `packages/core/src/canvas/NodeShape.ts`:
- Delete the local `interface RectPose` (line ~398) and import `isRectPose` from `'interactions/actions/resize/autoPoseDescriptor'` and `type RectPose` from `'core/scene/types'`.
- Retype the five rect-only painters as `NodeShapeEntry<unknown, RectPose>` and prefix each `matches` with the pose check. For example `TEXT_PAINTER`:

```ts
const TEXT_PAINTER: NodeShapeEntry<unknown, RectPose> = {
  id: 'kit:text',
  matches: (node) => {
    if (!isRectPose(node.pose)) return false;
    const d = node.data as { text?: string } | null;
    return d?.text != null;
  },
```

  `PATH_PAINTER`, `SHAPE_PAINTER`, `IMAGE_PAINTER` and `RECT_FALLBACK_PAINTER` get the same first line (`matches: () => true` becomes `matches: (node) => isRectPose(node.pose)`). Drop every `pose as RectPose` in their bodies — `pose` is now typed `RectPose`. `DERIVED_PAINTER` is untouched.
- `registerBuiltInShapePainters` registers them with `as NodeShapeEntry` casts where the registry is typed `NodeShapeEntry<unknown, unknown>`.
- Key the cache on pose shape as well as data. Add a second slot beside `PAINTER_SLOT` (find its declaration) — `const PAINTER_SLOT_NONRECT = …` built the same way — and in `findNodeShape`:

```ts
  // Built-in painters also gate on pose shape, so the key carries it too.
  const slot = isRectPose(node.pose) ? PAINTER_SLOT : PAINTER_SLOT_NONRECT;
  return nodeMemo(node as { data?: unknown }, slot, undefined, () => matchNodeShape(node));
```

  replacing the "No pose in the key" comment. Update the file header's `matches` description (line ~17) and the `NodeShapeEntry.matches` doc to say built-ins also require a rect pose.

In `packages/core/src/canvas/deps/editAnchors.ts`: delete `interface RectPoseShape`, import `isRectPose` and `type RectPose`, and in `classifyStorage` change the data branch guard to `if (data?.path && (data.path as { kind?: string }).kind === 'polygon' && isRectPose(node.pose))`, with `pose: node.pose` (now narrowed). Replace remaining `RectPoseShape` uses with `RectPose`.

- [ ] **Step 4: Run**

```bash
npx vitest run --project=core packages/core/src/canvas/NodeShape.test.ts packages/core/src/canvas/deps/editAnchors.test.tsx packages/core/src/canvas/deps/editAnchors.rotation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit` — exit 0.

```bash
git add -u packages/core/src/canvas
git commit -m "keep the built-in painters off poses they cannot read"
```

---

### Task 13: Consumers, docs and the changeset

**Files:**
- Modify: `apps/site/registry.ts`, `apps/draw/src/__tests__/geometryContract.test.ts`, `docs/extending.md`, `docs/adapters.md`
- Modify: `packages/core/src/index.ts` (module doc lines ~37–40), `packages/core/src/tools/builtin/index.ts` (lines ~9–10), `packages/core/src/interactions/actions/resize/autoPoseDescriptor.ts` (doc lines ~16–19)
- Create: `.changeset/pose-descriptor.md`

- [ ] **Step 1: Stale prose**

Fix each so it states current behavior:
- `apps/site/registry.ts:211` — "generalized over TPose via the optional `geometry` opt … `translatePath` as its translatePose" → the demo translates through its pose descriptor.
- `apps/site/registry.ts:220` — drop "via Canvas + the `geometry={pathPoseDescriptor}` prop" and "the adapter wires pathPoseDescriptor.intersectsRect"; say the canvas's default descriptor handles Path poses.
- `apps/draw/src/__tests__/geometryContract.test.ts:14-15,147-149` — comments about `resizePolicy`/`projection` → the `poseDescriptor` dep, AUTO when unwired.
- `docs/extending.md:218` — `translatePoseGeneric` consults `geometryProjection` → move translates through the `poseDescriptor` dep.
- `docs/adapters.md:156-159` — add `poseDescriptor` to the dep list.
- `packages/core/src/index.ts:37-40` — `useResizePolicy({ projection })` → `<SceneCanvas poseDescriptor>`.
- `packages/core/src/tools/builtin/index.ts:9-10` — resize policy no longer carries geometry.
- `autoPoseDescriptor.ts:16,19` — `geometry={pathPoseDescriptor}` → `poseDescriptor={…}`.

Then sweep:

```bash
cd /Users/mike/src/weasel-pose
grep -rn "resize: { geometry\|projection: ROTATED\|poseBounds\|RECT_ALIGN_PROJECTION\|AlignBoundsProjection\|RotateGeometry\|translatePoseGeneric\|geometry={pathPose\|geometry={ROTATED" packages apps docs --include='*.ts' --include='*.tsx' --include='*.md' | grep -v node_modules | grep -v '/dist/' | grep -v 'docs/superpowers/'
```

Expected: no output. Anything left is a stale reference to fix.

- [ ] **Step 2: The changeset**

Create `.changeset/pose-descriptor.md` listing every package with a changed public surface — check `packages/d3/package.json`, `packages/diagram/package.json`, `packages/weasel-js/package.json` for their names:

```md
---
'@weasel-js/core': patch
'@weasel-js/d3': patch
'@weasel-js/diagram': patch
---

Pose geometry is supplied once. `<SceneCanvas poseDescriptor={…}>` tells every built-in action, the selection chrome, picking and area select how to read and rewrite this scene's poses; it defaults to `AUTO_POSE_DESCRIPTOR` (rect and `Path` poses). A pose of any other shape now works end to end — before, dragging one into a container wrote `NaN` into it.

Breaking:

- `PoseProjection` is renamed `PoseDescriptor`, and gains a required `fromBounds(bounds, template)` and an optional `withRotation(pose, rotation)`.
- `ResizePose` and `AlignBounds` are removed; use `Bounds`.
- `RotateGeometry`, `AlignBoundsProjection` and `RECT_ALIGN_PROJECTION` are removed.
- Removed options, replaced by the descriptor: `selectTool.resize.geometry` and `useResizePolicy({ projection })` (use `<SceneCanvas poseDescriptor>`); `UseRotateOptions.geometry` and `UseMoveOptions.translatePose` (both were unread); `poseBounds` on `useSelectTool`, `arrayAdapter`, `sceneToAdapter`, `MinimapCanvas` and `nestedHitTester` (use their `poseDescriptor` option); `arrayAdapter`'s `intersectsRect` and `translatePose`; the selection overlay's `getBounds` and `fromBounds`; the alignment behaviors' `projection`.
- `Canvas`'s `geometry` prop is renamed `poseDescriptor`.
- `computeFitView`'s fourth argument is a `PoseDescriptor`, not a bounds function.
- `sceneToAdapter`'s `cascadeContainerPose` is a boolean; the cascade translates through the descriptor.
- The kit's built-in painters only draw rect poses. A node with any other pose needs its own painter.
- `Scene` has a read-only `registry`. `unionOfChildrenVia(descriptor)` builds a container-union function for a custom pose kind; register it under `UNION_OF_CHILDREN`.
```

Run: `npm run check:bumps` — expected: passes (patch only).

- [ ] **Step 3: Typecheck, lint, the other projects, commit**

```bash
npx tsc --noEmit
npm run lint
npx vitest run --project=weasel-ui packages/d3 packages/diagram
npx vitest run --project=draw apps/draw/src/__tests__/geometryContract.test.ts
```

Expected: exit 0 / PASS for each.

```bash
git add .changeset/pose-descriptor.md
git add -u apps docs packages
git commit -m "document the pose descriptor and migrate stale references"
```

---

### Task 14: The gate

Run once, by one agent, after checking nothing else is running (`pgrep -fl vitest`).

- [ ] **Step 1: Full checks**

```bash
cd /Users/mike/src/weasel-pose
npx tsc --noEmit
npm run lint
npm run check:test-projects
npm run check:manifests
npx vitest run
```

Expected: all pass. A failure in a file this branch did not touch, with the box under load, is contention — report it with the diff's reasoning; do not re-run.

- [ ] **Step 2: Consumer smoke and visual baselines**

```bash
npm run test:smoke:consumer
```

Then run the visual suite the way `package.json` defines it (`grep '"test:visual' package.json`). Expected: PASS — rect rendering must not move a pixel.

- [ ] **Step 3: Retire the plan paperwork**

When the branch is ready to merge (not before):

```bash
git rm docs/superpowers/plans/2026-09-11-pose-descriptor.md docs/superpowers/specs/2026-09-11-pose-descriptor-design.md
```

Edit `docs/superpowers/specs/2026-08-22-3d-kernel-design.md`: Phase 0 says "Built." and no longer points at the deleted spec. Commit:

```bash
git add -u docs
git commit -m "retire the pose descriptor plan and spec"
```

Report back: the commit list, test counts actually read from output, and anything skipped.
