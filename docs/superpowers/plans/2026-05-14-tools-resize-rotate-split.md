# Tools/Resize/Rotate Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make resize and rotation independent registered tools rather than sub-features of `useSelectTool`. SceneCanvas keeps the trio mounted by default but lets consumers slim the registered set via a `defaultTools` array selector. After the split, `useSelectTool` covers move + click + area-select only; `useResizeTool` and `useRotateTool` are siblings.

**Architecture:**
- **Per-tool ownership.** Each gesture controller (`useMove`, `useResize`, `useRotate`, `useAreaSelect`) plus its affordances and overlays lives in exactly one Tool. Resize owns the corner-resize affordance + `MULTI_RESIZE_TARGET_ID` synthesis; rotate owns the rotation handle. `useSelectTool` keeps the pointer-down classifier, click semantics, dblTap forwarding, marquee, and the move gesture (because move is the default drag for body hits — that's the select-tool's core role).
- **Cross-tool preview aggregation.** Today `Canvas.tsx` reads `tool.previewPose(id)` from a single active tool. After the split, multiple tools can publish previews. Canvas aggregates across `tools.registry` — first non-null wins. Since the dispatcher only allows one in-flight gesture at a time, only one tool has a live overlay at any moment, so first-wins is collision-free.
- **SceneCanvas chooses the registered subset.** New `defaultTools?: readonly BuiltinToolId[]` prop (default `['select', 'resize', 'rotate']`). SceneDemo passes `['select']` to disable resize/rotate, which is what surfaced the original bug.

**Tech Stack:** TypeScript, React 19, Vitest, existing kit (`src/tools/builtin/*`, `src/affordances/*`, `src/interactions/gestures/*`).

---

## File Structure

**Source files created:**
- `src/tools/builtin/useResizeTool/useResizeTool.ts` — gesture + corner-resize affordance + ghost overlay + previewPose/previewBounds/previewIds
- `src/tools/builtin/useResizeTool/index.ts` — re-export
- `src/tools/builtin/useRotateTool/useRotateTool.ts` — gesture + rotation handle affordance + ghost overlay + previewPose
- `src/tools/builtin/useRotateTool/index.ts` — re-export
- `src/tools/builtin/shared/selectionTarget.ts` — shared `MULTI_RESIZE_TARGET_ID`, `Bounds` type, `getSelectionRef` pattern (extracted from useSelectTool so it doesn't import the heavier file)

**Source files modified:**
- `src/tools/builtin/useSelectTool/useSelectTool.ts` — strip useResize, useRotate, corner+rotation affordances, MULTI_RESIZE_TARGET_ID synthesis, resize/rotate slices of preview*; keep useMove, useAreaSelect, pointerDownBody, click/dblTap routes, move ghost overlay
- `src/tools/builtin/useSelectTool/index.ts` — re-export only what stays
- `src/tools/builtin/index.ts` — add useResizeTool + useRotateTool exports
- `src/canvas/Canvas.tsx` — `previewToolPose` / `previewToolBounds` / `chromeState.effectiveBoundsOf` walk `tools.registry` instead of single tool; `getEffectivePose` and `previewIds` aggregator follows
- `src/canvas/SceneCanvas.tsx` — `defaultTools?: readonly BuiltinToolId[]` prop; passes selectTool options through; mounts the subset
- `src/canvas/SceneCanvas/useSceneSelectTool.ts` — return `resizeTool` and `rotateTool` alongside `selectTool`; thread the shared adapter/getSelection/boundsOf/options into them
- `src/tools/builtin/useEyedropperTool/useEyedropperTool.ts` — usage of `Bounds` import updated if path changed
- `src/tools/builtin/useSelectWithAnchorEdit/useSelectWithAnchorEdit.ts` — `useSelectTool` no longer returns the resize/rotate overlay slice; rewire if it relied on them

**Test files split/created:**
- `src/tools/builtin/useResizeTool/useResizeTool.test.ts` — corner-handle resize behavior moved from useSelectTool tests
- `src/tools/builtin/useResizeTool/useResizeTool.clipping.test.tsx` — clipping cases for resize moved over
- `src/tools/builtin/useRotateTool/useRotateTool.test.ts` — rotation handle cases moved over
- `src/tools/builtin/useSelectTool/useSelectTool.test.ts` — drops resize/rotate sections; keeps move + click + area-select + zorder
- `src/canvas/SceneCanvas.tools.test.tsx` — new: verifies `defaultTools` slimming actually skips resize/rotate registration

---

## Phase 1 — Cross-tool preview aggregation (no behavior change)

### Task 1: Aggregator helpers in Canvas

**Files:**
- Modify: `src/canvas/Canvas.tsx` (around lines 875–957)

- [ ] **Step 1: Read the current `previewToolPose` / `previewToolBounds` / `chromeState.effectiveBoundsOf`**

Confirm the single-tool reads on lines ~882–891, 944–957, and 1130–1140 (`previewIds`).

- [ ] **Step 2: Add three module-scoped helpers above `Canvas.tsx`'s `CanvasInner`**

```ts
function firstPreviewPose(tools: ToolsApi | undefined, id: string): unknown {
  if (!tools) return null;
  for (const t of Object.values(tools.registry)) {
    const p = t?.previewPose?.(id);
    if (p != null) return p;
  }
  return null;
}

function firstPreviewBounds(tools: ToolsApi | undefined, id: string): Bounds | null {
  if (!tools) return null;
  for (const t of Object.values(tools.registry)) {
    const b = t?.previewBounds?.(id);
    if (b) return b as Bounds;
  }
  return null;
}

function aggregatePreviewIds(tools: ToolsApi | undefined): Set<string> {
  const out = new Set<string>();
  if (!tools) return out;
  for (const t of Object.values(tools.registry)) {
    const ids = t?.previewIds?.();
    if (!ids) continue;
    for (const id of ids) out.add(id);
  }
  return out;
}
```

- [ ] **Step 3: Replace the three call sites with the helpers**

`chromeState.effectiveBoundsOf`, `previewToolPose`, `previewToolBounds`, and the `previewIds` walker inside `Canvas.tsx`'s scene layer all switch to the helpers. `previewToolBounds` falls back to `geometry.getBounds(firstPreviewPose(...))` exactly as today.

- [ ] **Step 4: Run full suite — must stay green because today only one tool publishes anything**

```bash
pnpm vitest run
```
Expected: 2893 passed.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/Canvas.tsx
git commit -m "refactor(canvas): aggregate tool previews across registry (no-op today)"
```

---

## Phase 2 — Shared module for selection-target plumbing

### Task 2: Carve out shared types so resize/rotate don't import useSelectTool

**Files:**
- Create: `src/tools/builtin/shared/selectionTarget.ts`
- Modify: `src/tools/builtin/useSelectTool/useSelectTool.ts` (lines 38–53, 39: `Bounds`, 53: `MULTI_RESIZE_TARGET_ID`)

- [ ] **Step 1: Create the shared file**

```ts
// src/tools/builtin/shared/selectionTarget.ts

/** World-space bounding rect for hit-testing handles. Uses `width`/`height` to
 *  match `cornerResizeHandles` and `rotationHandle` expectations. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** Synthetic id used by `<Canvas selectionMode="multi">` to address the
 *  union-AABB target when 2+ real ids are selected. */
export const MULTI_RESIZE_TARGET_ID = '__weasel:multi-selection';
```

- [ ] **Step 2: Update `useSelectTool.ts` to import these instead of redefining**

Replace lines 37–53 with:
```ts
import { Bounds, MULTI_RESIZE_TARGET_ID } from '../shared/selectionTarget';
export type { Bounds };
export { MULTI_RESIZE_TARGET_ID };
```
(The re-exports preserve external callers' imports.)

- [ ] **Step 3: Typecheck + tests**

```bash
pnpm exec tsc --noEmit && pnpm vitest run
```
Expected: 2893 passed.

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/shared/selectionTarget.ts src/tools/builtin/useSelectTool/useSelectTool.ts
git commit -m "refactor(tools): extract Bounds + MULTI_RESIZE_TARGET_ID to shared module"
```

---

## Phase 3 — Extract `useResizeTool`

### Task 3: Stand up `useResizeTool` next to `useSelectTool` (still parallel, not yet wired)

**Files:**
- Create: `src/tools/builtin/useResizeTool/useResizeTool.ts`
- Create: `src/tools/builtin/useResizeTool/index.ts`
- Reference (do not modify yet): `src/tools/builtin/useSelectTool/useSelectTool.ts` lines 191 (`useResize` call), 419–591 (`cornerAff` + `cornerAffWrapped`), 697–712 (preview helpers' resize branches), 762–771 (previewIds resize branch).

- [ ] **Step 1: Create `useResizeTool/useResizeTool.ts` with the option type**

```ts
import { useMemo, useRef, createElement } from 'react';
import { useResize, type UseResizeOptions } from 'interactions/gestures/resize/resize';
import {
  createCornerResizeAffordance,
  type CornerResizeScratch,
} from 'affordances/cornerResize';
import { composeAffordanceLayer } from 'affordances/composeAffordanceLayer';
import type { Affordance, AffordanceBinding } from 'affordances/types';
import type { ResizeAdapter } from 'core/adapters/types';
import type { ResizeAnchor } from 'interactions/gestures/types';
import { defineTool, mods, begin, claim, none } from '../../routing';
import type { ActionFn } from '../../routing';
import type { Tool, ToolBounds, ToolCtx } from '../../types';
import type { RenderLayer } from 'core/layers/render';
import { createTransformOp } from 'core/ops/transform';
import { Bounds, MULTI_RESIZE_TARGET_ID } from '../shared/selectionTarget';
import { RESIZE_ICON_ID } from '../../../icons'; // (or reuse SelectIcon for now; see Task 4)

export interface UseResizeToolOptions<TNode extends { id: string }, TPose> {
  resize?: UseResizeOptions<TPose>;
  handleHitRadius?: number;
  boundsOf?: (id: string) => Bounds | null;
  getSelection?: () => string[];
  /** Pose→bounds projection used for MULTI_RESIZE_TARGET_ID leaf-bound union. */
  poseBounds?: (pose: TPose) => Bounds;
  getNode?: (id: string) => TNode | null;
}

export function useResizeTool<TNode extends { id: string }, TPose>(
  adapter: ResizeAdapter<TPose>,
  options: UseResizeToolOptions<TNode, TPose>,
): Tool<unknown> {
  // body from old useSelectTool, condensed
}
```

(Real body in next step.)

- [ ] **Step 2: Port the resize wiring from `useSelectTool.ts` into `useResizeTool.ts`**

Move these blocks verbatim (adjust imports to relative paths and to new option names):
- `const resize = useResize<TNode, TPose>(adapter, options.resize ?? {});` (line 192)
- `cornerAff` + `cornerAffWrapped` (lines 419–591) — the *entire* corner-resize affordance, including the multi-mode union branch
- Ghost overlay slice for resize (within lines 393–410 — the `rOv = resize.overlay` part of the combined ghost; this tool emits its own RenderLayer composed of the affordance layer + the ghost slice)
- `previewPose` resize branch (lines 703–708)
- `previewBounds` MULTI_RESIZE_TARGET_ID synthesis (lines 722–753) — `useResizeTool` owns the multi-union bounds
- `previewIds` resize branch (lines 766–771)

Return shape:
```ts
return {
  ...defineTool({
    id: 'resize',
    keybinding: { key: 'R' /* or undefined — see Task 8 */ },
    cursor: () => 'default',
    presentation: { label: 'Resize', group: 'select' },
    initial: { /* no pointerDown / drag — resize is affordance-only */ },
  }),
  overlay,           // RenderLayer with hitTest (affordance) + ghost draw
  previewPose,
  previewBounds,
  previewIds,
};
```

- [ ] **Step 3: Create the index re-export**

```ts
// src/tools/builtin/useResizeTool/index.ts
export { useResizeTool } from './useResizeTool';
export type { UseResizeToolOptions } from './useResizeTool';
```

- [ ] **Step 4: Typecheck — no consumer wired yet, just confirm the new file compiles**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useResizeTool/
git commit -m "feat(tools): extract useResizeTool (parallel impl, not yet wired)"
```

### Task 4: Move resize tests onto the new tool

**Files:**
- Create: `src/tools/builtin/useResizeTool/useResizeTool.test.ts`
- Create: `src/tools/builtin/useResizeTool/useResizeTool.clipping.test.tsx`
- Modify: `src/tools/builtin/useSelectTool/useSelectTool.test.ts` (drop the resize sections)
- Modify: `src/tools/builtin/useSelectTool/useSelectTool.clipping.test.tsx` (drop resize-clipping sections; keep selection/move clipping)

- [ ] **Step 1: Identify the resize test blocks in `useSelectTool.test.ts`**

```bash
grep -n "describe\|resize\|handle" src/tools/builtin/useSelectTool/useSelectTool.test.ts
```
Expected: a handful of `describe('corner resize ...')`, `describe('multi-resize ...')` blocks. Note their line ranges.

- [ ] **Step 2: Cut those describe blocks and paste into `useResizeTool.test.ts`**

Adjust imports: `import { useResizeTool } from './useResizeTool';` and replace `useSelectTool(adapter, opts)` calls with two-tool registration (`useSelectTool(...)` + `useResizeTool(...)` mounted into the same `useTools({ registry: { select, resize } })`).

- [ ] **Step 3: Run the new test file**

```bash
pnpm vitest run src/tools/builtin/useResizeTool/
```
Expected: all moved tests pass.

- [ ] **Step 4: Run the trimmed useSelectTool tests**

```bash
pnpm vitest run src/tools/builtin/useSelectTool/
```
Expected: all remaining tests pass (no `cannot find` errors).

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/useResizeTool/*.test.* src/tools/builtin/useSelectTool/useSelectTool.test.ts src/tools/builtin/useSelectTool/useSelectTool.clipping.test.tsx
git commit -m "test(tools): move resize tests from useSelectTool to useResizeTool"
```

---

## Phase 4 — Extract `useRotateTool`

### Task 5: Stand up `useRotateTool` parallel to `useResizeTool`

**Files:**
- Create: `src/tools/builtin/useRotateTool/useRotateTool.ts`
- Create: `src/tools/builtin/useRotateTool/index.ts`

- [ ] **Step 1: Mirror Task 3's structure for rotation**

Move from `useSelectTool.ts`:
- `useRotate` call (line 193)
- `rotationAff` + `rotationAffWrapped` (lines 595–655)
- Ghost overlay rotate slice (within 405–410)
- `previewPose` rotate branch (lines 709–711)
- `previewIds` rotate branch (lines 772–774 area)

Option type:
```ts
export interface UseRotateToolOptions<TNode extends { id: string }, TPose> {
  rotate?: UseRotateOptions<TPose>;
  /** Distance from top edge of bounds to rotation handle center. Default: 24. */
  rotationHandleDistance?: number;
  handleHitRadius?: number;
  boundsOf?: (id: string) => Bounds | null;
  getSelection?: () => string[];
  getNode?: (id: string) => TNode | null;
}
```

Return shape mirrors useResizeTool.

- [ ] **Step 2: index.ts re-export**

```ts
export { useRotateTool } from './useRotateTool';
export type { UseRotateToolOptions } from './useRotateTool';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/tools/builtin/useRotateTool/
git commit -m "feat(tools): extract useRotateTool (parallel impl, not yet wired)"
```

### Task 6: Move rotation tests onto the new tool

Identical pattern to Task 4 but for rotation describe blocks. Resulting commit:

```bash
git commit -m "test(tools): move rotation tests from useSelectTool to useRotateTool"
```

---

## Phase 5 — Strip resize/rotate from `useSelectTool`

### Task 7: Cut the dead code

**Files:**
- Modify: `src/tools/builtin/useSelectTool/useSelectTool.ts`

- [ ] **Step 1: Remove these imports**

```ts
// DELETE:
import { useResize, type UseResizeOptions } from 'interactions/gestures/resize/resize';
import { useRotate, type UseRotateOptions } from 'interactions/gestures/rotate/rotate';
import { createCornerResizeAffordance, type CornerResizeScratch } from 'affordances/cornerResize';
import { createRotationAffordance, type RotationScratch } from 'affordances/rotationHandle';
```

- [ ] **Step 2: Remove from `UseSelectToolOptions`**

```ts
// DELETE these option fields:
//   resize?: UseResizeOptions<TPose>;
//   rotate?: UseRotateOptions<TPose>;
//   rotationHandleDistance?: number;
//   handleHitRadius?: number;   // moves to useResizeTool / useRotateTool
```

- [ ] **Step 3: Delete the gesture wiring (line 192–193 era), affordance wrappers (419–655), preview branches (697–774 — keep move-only slices), and the composeAffordanceLayer call (665–670).**

The remaining `overlay` is the move ghost overlay only.

- [ ] **Step 4: Update `useMemo` dependencies in the `defineTool` call's outer memo to drop resize/rotate.**

- [ ] **Step 5: Run useSelectTool tests**

```bash
pnpm vitest run src/tools/builtin/useSelectTool/
```
Expected: passes (resize/rotate tests already moved in Tasks 4 & 6).

- [ ] **Step 6: Run integration tests**

```bash
pnpm vitest run src/tools/builtin/integration.test.tsx
```
Expected: may need updates if it instantiates a select tool with resize/rotate options — split into separate tool registrations.

- [ ] **Step 7: Commit**

```bash
git add src/tools/builtin/useSelectTool/
git commit -m "refactor(useSelectTool): drop resize/rotate (now separate tools)"
```

### Task 8: Re-key keyboards

**Files:**
- Modify: `src/tools/builtin/useResizeTool/useResizeTool.ts`
- Modify: `src/tools/builtin/useRotateTool/useRotateTool.ts`

- [ ] **Step 1: Decide keybindings**

Resize and rotate today have no top-level keybinding (they're affordance-driven). Keep that — `keybinding: undefined`. They activate via affordance hit-test only. This means no toolbar entry conflict and no surprise mode switch on R-press.

- [ ] **Step 2: Confirm by running the full suite**

```bash
pnpm vitest run
```

- [ ] **Step 3: Commit only if anything changed**

(No-op task likely. Skip commit if no diff.)

---

## Phase 6 — Wire SceneCanvas to mount the trio

### Task 9: `useSceneSelectTool` returns the trio

**Files:**
- Modify: `src/canvas/SceneCanvas/useSceneSelectTool.ts`

- [ ] **Step 1: Add resize + rotate hooks alongside select**

```ts
import { useResizeTool } from 'tools/builtin/useResizeTool';
import { useRotateTool } from 'tools/builtin/useRotateTool';

// ... inside useSceneSelectTool, after `const selectTool = useSelectTool(...)`:

const resizeTool = useResizeTool<Node<TData, TLayer, TPose>, TPose>(adapter, {
  ...(resizeOptions ? { resize: resizeOptions } : {}),
  ...(handleHitRadius !== undefined ? { handleHitRadius } : {}),
  boundsOf: wiredBoundsOf,
  getSelection: () => selection.current,
  // poseBounds: identity for {x,y,width,height}; reuse adapter.poseBounds
  poseBounds: adapter.poseBounds ?? ((p) => p as unknown as Bounds),
  getNode: (id) => scene.get(asNodeId(id)) ?? null,
});

const rotateTool = useRotateTool<Node<TData, TLayer, TPose>, TPose>(adapter, {
  ...(rotateOptions ? { rotate: rotateOptions } : {}),
  ...(handleHitRadius !== undefined ? { handleHitRadius } : {}),
  boundsOf: wiredBoundsOf,
  getSelection: () => selection.current,
  getNode: (id) => scene.get(asNodeId(id)) ?? null,
});
```

- [ ] **Step 2: Extend the return type and value**

```ts
return {
  adapter,
  selectTool,
  resizeTool,
  rotateTool,
  pickEvery: wiredHitBody,
};
```

Update the interface above to include them.

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/canvas/SceneCanvas/useSceneSelectTool.ts
git commit -m "feat(scene-canvas): synthesize resize + rotate tools alongside select"
```

### Task 10: SceneCanvas `defaultTools` selector

**Files:**
- Modify: `src/canvas/SceneCanvas.tsx`

- [ ] **Step 1: Add the prop**

```ts
type BuiltinToolId = 'select' | 'resize' | 'rotate' | 'hand';

// On SceneCanvasProps:
defaultTools?: readonly BuiltinToolId[];
```

JSDoc: "Which built-in tools to register. Defaults to all three pointer tools (`['select', 'resize', 'rotate']`) plus hand if the viewport feature is on. Pass a smaller array to slim — e.g. `['select']` for move-only."

- [ ] **Step 2: Build the registry from the selector**

```ts
const requestedTools = defaultTools ?? ['select', 'resize', 'rotate'] as const;
const want = (id: BuiltinToolId) => requestedTools.includes(id);

const internalRegistry: Record<string, AnyTool> = {};
if (want('select')) internalRegistry.select = internalSelect;
if (want('resize')) internalRegistry.resize = resizeTool;
if (want('rotate')) internalRegistry.rotate = rotateTool;
if (viewportRegistered && want('hand') !== false) internalRegistry.hand = handTool;
```

(Replace the current monolithic `internalRegistry` construction around line 357.)

- [ ] **Step 3: Run the scene-canvas tests**

```bash
pnpm vitest run src/canvas/SceneCanvas
```
Expected: existing tests pass because the default includes all three.

- [ ] **Step 4: Commit**

```bash
git add src/canvas/SceneCanvas.tsx
git commit -m "feat(scene-canvas): defaultTools prop selects which built-ins to mount"
```

### Task 11: SceneDemo passes `defaultTools: ['select']`

**Files:**
- Modify: `demo/demos/SceneDemo.tsx`

- [ ] **Step 1: Add the prop**

```tsx
<SceneCanvas
  /* ...existing props... */
  defaultTools={['select']}
/>
```

- [ ] **Step 2: Browser sanity check**

Visit `/weasel/?demo=Scene`, click a rect, drag → moves. Click corner → no resize (no affordance registered). No visible handles.

- [ ] **Step 3: Commit**

```bash
git add demo/demos/SceneDemo.tsx
git commit -m "demo(scene): mount move-only via defaultTools"
```

### Task 12: Regression test for `defaultTools` slimming

**Files:**
- Create: `src/canvas/SceneCanvas.tools.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SceneCanvas, sceneFromJSON } from '../index';

describe('SceneCanvas defaultTools', () => {
  it('omits resize when defaultTools=["select"]', () => {
    const scene = sceneFromJSON({ /* tiny fixture */ }, {});
    // Mount and reach into the tools API via a ref or test helper.
    // Assertion: tools.registry has 'select', does NOT have 'resize' / 'rotate'.
  });

  it('defaults register select + resize + rotate', () => {
    // Inverse: defaultTools omitted → all three present.
  });
});
```

Fill in the fixture and ref-plumbing using existing SceneCanvas tests as the model.

- [ ] **Step 2: Run**

```bash
pnpm vitest run src/canvas/SceneCanvas.tools.test.tsx
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/canvas/SceneCanvas.tools.test.tsx
git commit -m "test(scene-canvas): defaultTools controls registered set"
```

---

## Phase 7 — Migrate remaining consumers

### Task 13: Audit non-SceneCanvas consumers of `useSelectTool`

**Files (read-only audit):**
- `apps/swillustrator/src/App.tsx`
- `demo/demos/*.tsx` that import `useSelectTool` directly (Lasso, Compose, Clipboard, ShapeTools, NestedGroups, Clone, AlignDistributeFlip, MultiSelect, BezierEdit, PointSnap, LayerList, Groups, Animation, ToolReflection)

- [ ] **Step 1: List sites passing `resize` or `rotate` options to `useSelectTool`**

```bash
grep -rn "useSelectTool" apps/ demo/ | xargs grep -l "resize:\|rotate:" 2>/dev/null
```

- [ ] **Step 2: For each, decide whether the demo needs the resize/rotate tool**

(Most demos do — they're showcase demos for those gestures.)

### Task 14: Migrate swillustrator + any demos passing resize/rotate options

**Files:** the list from Task 13.

For each consumer:
- [ ] **Step 1: Add `useResizeTool(...)` and `useRotateTool(...)` calls with the options previously passed to `useSelectTool`**
- [ ] **Step 2: Add `resize` and `rotate` entries to the `useTools({ registry: { ... } })` call**
- [ ] **Step 3: Run that file's tests (if any) + browser-spot-check the demo**
- [ ] **Step 4: Commit per consumer** with `refactor(<consumer>): mount resize/rotate via dedicated tools`

(Do not batch — one commit per consumer keeps the diff reviewable.)

### Task 15: Final verification

- [ ] **Step 1: Full suite + typecheck + build**

```bash
pnpm exec tsc --noEmit && pnpm vitest run && pnpm exec tsup
```
Expected: green across the board.

- [ ] **Step 2: Browser spot-check**

Visit each demo that uses resize/rotate. Confirm corner-drag still resizes, rotation handle still appears above the bounds.

- [ ] **Step 3: Push when satisfied**

```bash
git push origin main
```

---

## Self-Review Notes

**Spec coverage:** every requirement (resize/rotate become separate tools, defaultTools prop, demo defaults to move-only) lands in a numbered task.

**Open risk:** `useSelectWithAnchorEdit` composes `useSelectTool` and may rely on its old return shape (resize/rotate overlay slices). It's flagged in "File Structure" but I haven't traced its surface here — Task 14's audit catches it. If it breaks, add an explicit pre-Task-7 step to rewire it.

**Cross-tool affordance ordering:** today `composeAffordanceLayer` runs corner-resize then rotation in REVERSE for hit-test (rotation first). After the split, each tool publishes its own overlay; the dispatcher's `getActiveOverlays` walks foreground-first. Active is `select`; ambient is `resize` + `rotate`. We need to confirm the order keeps rotation hits priority over corner-resize hits in the new layering — verifiable in Task 12's tests.

**Multi-resize:** `MULTI_RESIZE_TARGET_ID` and its `previewBounds` synthesis move into `useResizeTool`. The Phase 1 aggregator in Canvas pulls the union via `firstPreviewBounds(tools, MULTI_RESIZE_TARGET_ID)`, which walks the registry until resize returns the union. Correct without further plumbing.

**Backward compat:** consumers using `useSelectTool` directly with `resize` / `rotate` options break at Task 7. Task 14 migrates them. There is no shim — explicit migration is the cleaner outcome.
