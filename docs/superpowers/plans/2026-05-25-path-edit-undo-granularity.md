# Path-edit undo granularity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pen edit-mode emit one undo entry per gesture (click or drag), matching the rest of the kit. Coalesce per-tick cursor movement within a drag by not pushing intermediate ops at all.

**Architecture:** Move pen edit-mode from "push an op every onMove tick" to "mutate scratch + render during gesture; push one op on release." Each gesture captures a per-gesture `from` baseline at its start so each pushed op rewinds only its own gesture (not the entire edit session). The path-edit modality's existing `Journal` (`apps/draw/src/modality/machine.ts:76`) then squashes those per-gesture entries into one outer-history entry on mode commit.

**Tech Stack:** TypeScript, React, Vitest. Files in `src/tools/builtin/pen/`.

**Spec:** `docs/superpowers/specs/2026-05-25-path-edit-undo-granularity-design.md`

---

## File Map

- Modify: `src/tools/builtin/pen/penEdit/scratch.ts` — add `gestureBaseline` field to `PenEditState`; replace `commitEditAsOp` with `commitWithBaseline(scratch, baseline, label)` that takes an explicit `from`; drop the `original` field and the `coalesceKey`.
- Modify: `src/tools/builtin/pen/usePenTool.ts` — drag handlers capture a baseline at gesture start, stop calling `applyOps` per tick, and commit one op on release. One-shot actions (segment-click, scissors, nudge) capture a baseline inline. `commitEditAndExit` becomes a thin exit.
- Modify: `src/tools/builtin/pen/usePenTool.edit.test.tsx` — update callers of `commitEditAsOp` to use the new helper; update the assertion that `preConvert` survives entry-without-mutation (now relevant when the first gesture finally fires).

---

## Task 1: Reshape `PenEditState` + commit helper

**Files:**
- Modify: `src/tools/builtin/pen/penEdit/scratch.ts`
- Modify: `src/tools/builtin/pen/usePenTool.ts` (the `PenEditState` interface declaration is here, not in scratch.ts)

**Context for the engineer:** `PenEditState` is declared inline in `usePenTool.ts` (around L46–L60), but the helpers that read/write it live in `penEdit/scratch.ts`. We add a `gestureBaseline` field in the interface and rewrite the commit helper.

- [ ] **Step 1: Add `gestureBaseline` to `PenEditState`**

Edit `src/tools/builtin/pen/usePenTool.ts`, the `PenEditState` interface. Remove the `original` field and add a `gestureBaseline` field. The interface should read:

```ts
/** @internal */
export interface PenEditState {
  objId: string;
  anchors: KitPenAnchor[][];
  closed: boolean[];
  selectedAnchors: Set<string>;
  activeHandle: { sub: number; anchor: number; side: 'in' | 'out' } | null;
  dirty: boolean;
  preConvert: { path: unknown; closed: boolean; params: unknown } | null;
  /** Snapshot of the path-as-it-was at the start of the current gesture
   *  (drag, click, or nudge keystroke). Used as the `from` of the
   *  SetPathOp emitted on gesture completion so each pushed entry rewinds
   *  only its own gesture, not the whole edit session. Null between
   *  gestures. */
  gestureBaseline: { path: unknown; closed: boolean; params: unknown } | null;
  /** In-flight marquee rect (world-space). Null when not dragging. */
  marquee: { x0: number; y0: number; x1: number; y1: number; additive: boolean } | null;
}
```

- [ ] **Step 2: Rewrite `scratch.ts` — drop `original`, replace `commitEditAsOp`, expose a baseline-capture helper**

Replace the body of `src/tools/builtin/pen/penEdit/scratch.ts` with:

```ts
import { pathToAnchors, anchorsToPath } from 'features/paths/anchors';
import type { PolygonPath, RectPath } from 'features/paths/types';
import { createSetPathOp } from 'core/ops/setPath';
import type { Op } from 'core/ops/types';
import type { PenScratch } from '../usePenTool';

export interface EnterEditArgs {
  objId: string;
  path: PolygonPath | RectPath;
  closed: boolean;
  params: unknown;
  isParametric: boolean;
}

export function enterEditMode(scratch: PenScratch, args: EnterEditArgs): void {
  const derived =
    args.path.kind === 'rect'
      ? rectToAnchors(args.path)
      : pathToAnchors(args.path);
  const closedArr = derived.closed.length > 0 ? derived.closed : [args.closed];

  scratch.mode = 'edit';
  scratch.edit = {
    objId: args.objId,
    anchors: derived.anchors,
    closed: closedArr,
    selectedAnchors: new Set(),
    activeHandle: null,
    dirty: false,
    preConvert: args.isParametric
      ? { path: args.path, closed: args.closed, params: args.params }
      : null,
    gestureBaseline: null,
    marquee: null,
  };
}

export function exitEditMode(scratch: PenScratch): void {
  scratch.mode = 'create';
  scratch.edit = null;
}

function rectToAnchors(
  rect: RectPath,
): { anchors: { x: number; y: number }[][]; closed: boolean[] } {
  return {
    anchors: [[
      { x: rect.x,               y: rect.y },
      { x: rect.x + rect.width,  y: rect.y },
      { x: rect.x + rect.width,  y: rect.y + rect.height },
      { x: rect.x,               y: rect.y + rect.height },
    ]],
    closed: [true],
  };
}

/**
 * Capture the gesture baseline — the path/closed/params snapshot used as
 * the `from` of the SetPathOp emitted when this gesture completes.
 *
 * On the first gesture in a session against a parametric shape, the
 * baseline IS the parametric form (sourced from `preConvert`), so undo
 * restores the original rect/etc. `preConvert` is then cleared so
 * subsequent gestures' baselines are plain polygons.
 */
export function captureGestureBaseline(scratch: PenScratch): void {
  if (!scratch.edit) return;
  if (scratch.edit.gestureBaseline !== null) return;
  if (scratch.edit.preConvert) {
    scratch.edit.gestureBaseline = {
      path: scratch.edit.preConvert.path,
      closed: scratch.edit.preConvert.closed,
      params: scratch.edit.preConvert.params,
    };
    scratch.edit.preConvert = null;
    return;
  }
  scratch.edit.gestureBaseline = {
    path: anchorsToPath(scratch.edit.anchors, scratch.edit.closed),
    closed: scratch.edit.closed[0] ?? false,
    params: undefined,
  };
}

/**
 * Build the SetPathOp for the current gesture and clear gestureBaseline.
 * Returns null when no baseline was captured (caller forgot) or the edit
 * isn't dirty (no-op gesture — don't push). Does NOT clear `dirty`; the
 * edit-session-wide dirty flag stays true so consumers still know a
 * session had real mutation.
 */
export function commitGestureOp(scratch: PenScratch, label: string): Op | null {
  if (!scratch.edit) return null;
  if (!scratch.edit.gestureBaseline) return null;
  if (!scratch.edit.dirty) {
    scratch.edit.gestureBaseline = null;
    return null;
  }
  const baseline = scratch.edit.gestureBaseline;
  const newPath = anchorsToPath(scratch.edit.anchors, scratch.edit.closed);
  const newClosed = scratch.edit.closed[0] ?? false;
  // Same-state guard: if the gesture's net change is identity, suppress.
  // anchorsToPath is deterministic, so a reference-stable compare on the
  // path bytes / closed flag would also work but isn't worth the cost
  // here — the history layer's mutation detector also skips no-op pushes.
  scratch.edit.gestureBaseline = null;
  return createSetPathOp({
    id: scratch.edit.objId,
    from: baseline,
    to: { path: newPath, closed: newClosed, params: undefined },
    label,
  });
}
```

Note: the `coalesceKey: penEdit:${objId}` is intentionally absent. Per-gesture entries must not merge across gestures. Within a gesture we now coalesce by not pushing intermediate ops at all.

- [ ] **Step 3: Update the export site so callers reach the new helpers**

`scratch.ts` already exports its functions individually. Nothing extra to do, but verify the file's exports include `captureGestureBaseline` and `commitGestureOp`, and no longer export `commitEditAsOp`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only at the call sites of `commitEditAsOp` and `scratch.edit.original` — those are addressed in Task 2/3. No errors inside `scratch.ts` itself.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/pen/penEdit/scratch.ts src/tools/builtin/pen/usePenTool.ts
git commit -m "refactor(pen-edit): add gestureBaseline + commitGestureOp helpers"
```

---

## Task 2: Rewire drag handlers to per-gesture commit

**Files:**
- Modify: `src/tools/builtin/pen/usePenTool.ts` (drag.anchor at ~L714, drag.handle at ~L771)

**Context for the engineer:** Today, `drag.anchor` and `drag.handle` call `commitEditAsOp` + `applyOps` inside `onMove` — so every cursor sample becomes its own undo entry. The fix: capture a baseline once at `begin`, mutate scratch + render inside `onMove` without committing, and emit one op on `onRelease`.

- [ ] **Step 1: Replace `drag.anchor`**

Find the `drag.anchor` handler (search for `anchor: (ctx) => {` inside the `drag:` block, around L714). Replace its body with:

```ts
anchor: (ctx) => {
  if (ctx.scratch.mode !== 'edit') return none();
  const extra = (ctx.target as { extra: { sub: number; idx: number } }).extra;
  let lastX = ctx.worldX, lastY = ctx.worldY;
  captureGestureBaseline(ctx.scratch);
  return begin<PenScratch>({
    scratch: ctx.scratch,
    onMove: (c) => {
      const dx = c.worldX - lastX;
      const dy = c.worldY - lastY;
      lastX = c.worldX; lastY = c.worldY;
      dragAnchor(c.scratch, { sub: extra.sub, idx: extra.idx, dx, dy });
      forceRenderRef.current();
      return claim();
    },
    onRelease: (c) => {
      const op = commitGestureOp(c.scratch, 'Move anchor');
      if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Move anchor');
      forceRenderRef.current();
      return claim();
    },
    onCancel: (c) => {
      if (c.scratch.edit) c.scratch.edit.gestureBaseline = null;
    },
  });
},
```

- [ ] **Step 2: Replace `drag.handle`**

Find `handle: (ctx) => {` inside the `drag:` block, ~L771. Replace its body with:

```ts
handle: (ctx) => {
  if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return none();
  const extra = (ctx.target as { extra: { sub: number; idx: number; side: 'in' | 'out' } }).extra;
  ctx.scratch.edit.activeHandle = { sub: extra.sub, anchor: extra.idx, side: extra.side };
  captureGestureBaseline(ctx.scratch);
  return begin<PenScratch>({
    scratch: ctx.scratch,
    onMove: (c) => {
      if (!c.scratch.edit?.activeHandle) return none();
      const h = c.scratch.edit.activeHandle;
      dragHandle(c.scratch, {
        sub: h.sub, idx: h.anchor, side: h.side,
        toX: c.worldX, toY: c.worldY,
        breakSmoothness: c.modifiers.alt,
      });
      forceRenderRef.current();
      return claim();
    },
    onRelease: (c) => {
      const op = commitGestureOp(c.scratch, 'Move handle');
      if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Move handle');
      if (c.scratch.edit) c.scratch.edit.activeHandle = null;
      forceRenderRef.current();
      return claim();
    },
    onCancel: (c) => {
      if (c.scratch.edit) {
        c.scratch.edit.activeHandle = null;
        c.scratch.edit.gestureBaseline = null;
      }
    },
  });
},
```

- [ ] **Step 3: Update the import line**

At the top of `usePenTool.ts`, change:

```ts
import { commitEditAsOp, exitEditMode, enterEditMode } from './penEdit/scratch';
```

to:

```ts
import { captureGestureBaseline, commitGestureOp, exitEditMode, enterEditMode } from './penEdit/scratch';
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors point only at the one-shot call sites still using `commitEditAsOp` (segment click ~L699, anchor scissors ~L687, `nudgeRouteFor` ~L330, `commitEditAndExit` ~L317).

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/pen/usePenTool.ts
git commit -m "fix(pen-edit): one undo entry per anchor/handle drag"
```

---

## Task 3: Rewire one-shot actions (segment add, scissors, nudge, exit)

**Files:**
- Modify: `src/tools/builtin/pen/usePenTool.ts`

**Context:** The remaining `commitEditAsOp` callers are not drags — they're individual click / keystroke actions. Each one should now capture a baseline immediately before its mutation, then call `commitGestureOp`.

- [ ] **Step 1: Update `commitEditAndExit` (~L316)**

Replace its body with:

```ts
function commitEditAndExit(s: PenScratch): void {
  // Per-gesture entries have already been pushed via the path-edit
  // Journal. Mode exit is a pure UI transition — the modality machine's
  // commit/suspend handles the journal lifecycle.
  exitEditMode(s);
  forceRenderRef.current();
}
```

- [ ] **Step 2: Update `nudgeRouteFor` (~L325)**

Replace its body with:

```ts
function nudgeRouteFor(dx: number, dy: number): (ctx: ToolCtx<PenScratch>) => Result<PenScratch> {
  return (ctx: ToolCtx<PenScratch>): Result<PenScratch> => {
    if (ctx.scratch.mode !== 'edit') return none();
    const step = ctx.modifiers.shift ? 10 : 1;
    captureGestureBaseline(ctx.scratch);
    nudgeSelectedAnchors(ctx.scratch, { dx: dx * step, dy: dy * step });
    const op = commitGestureOp(ctx.scratch, 'Nudge anchor');
    if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Nudge anchor');
    forceRenderRef.current();
    return claim();
  };
}
```

(Each keystroke is its own gesture → its own entry. Matches `interactions/actions/defaults/nudge.ts`.)

- [ ] **Step 3: Update `click.anchor` scissors branch (~L681)**

Find the `anchor: (ctx) => {` handler inside the `click:` block. Replace with:

```ts
anchor: (ctx) => {
  if (ctx.scratch.mode !== 'edit') return none();
  const extra = (ctx.target as { extra: { sub: number; idx: number } }).extra;
  if (ctx.modifiers.alt) {
    // Scissors — only meaningful on a closed subpath; the action no-ops otherwise.
    captureGestureBaseline(ctx.scratch);
    scissorsAtAnchor(ctx.scratch, extra);
    const op = commitGestureOp(ctx.scratch, 'Scissors');
    if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Scissors');
  } else {
    selectAnchor(ctx.scratch, { sub: extra.sub, idx: extra.idx, additive: ctx.modifiers.shift });
  }
  forceRenderRef.current();
  return claim();
},
```

- [ ] **Step 4: Update `click.segment` handler (~L695)**

Replace with:

```ts
segment: (ctx) => {
  if (ctx.scratch.mode !== 'edit') return none();
  const extra = (ctx.target as { extra: { sub: number; segIdx: number; t: number } }).extra;
  captureGestureBaseline(ctx.scratch);
  addAnchorOnSegment(ctx.scratch, extra);
  const op = commitGestureOp(ctx.scratch, 'Add anchor');
  if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Add anchor');
  forceRenderRef.current();
  return claim();
},
```

- [ ] **Step 5: Search for any remaining `commitEditAsOp` references**

Run: `grep -n "commitEditAsOp\|edit\.original" src/tools/builtin/pen/`
Expected output: zero matches in the source files (the test file is still allowed for now — Task 4 fixes it).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only inside `usePenTool.edit.test.tsx`. Production code is clean.

- [ ] **Step 7: Commit**

```bash
git add src/tools/builtin/pen/usePenTool.ts
git commit -m "fix(pen-edit): one undo entry per click/scissors/nudge gesture"
```

---

## Task 4: Update tests to match new helper shape

**Files:**
- Modify: `src/tools/builtin/pen/usePenTool.edit.test.tsx`

**Context:** Existing tests call `commitEditAsOp(scratch)` directly. The replacement helper requires a baseline to be captured first, then takes a label. Two existing tests need updating: the "move anchor" test (~L173) and the "rect trapdoor" test (~L263). They were exercising the old "session-wide" commit, but the new "per-gesture" commit produces an equivalent op when the test captures a baseline immediately before the mutation, so the existing assertions about the emitted op + undo round-trip should still hold.

- [ ] **Step 1: Update the import**

Change `src/tools/builtin/pen/usePenTool.edit.test.tsx:4` from:

```ts
import { commitEditAsOp } from './penEdit/scratch';
```

to:

```ts
import { captureGestureBaseline, commitGestureOp } from './penEdit/scratch';
```

- [ ] **Step 2: Update the "move anchor" test (~L169–L175)**

Replace:

```ts
dragAnchor(scratch, { sub: 0, idx: 1, dx: 0, dy: 5 });
expect(scratch.edit!.dirty).toBe(true);

// Build the op (same as drag route's onRelease) and apply it.
const op = commitEditAsOp(scratch);
expect(op).not.toBeNull();
history.applyOps([op!], 'Move anchor');
```

with:

```ts
captureGestureBaseline(scratch);
dragAnchor(scratch, { sub: 0, idx: 1, dx: 0, dy: 5 });
expect(scratch.edit!.dirty).toBe(true);

// Build the op (same as drag route's onRelease) and apply it.
const op = commitGestureOp(scratch, 'Move anchor');
expect(op).not.toBeNull();
history.applyOps([op!], 'Move anchor');
```

- [ ] **Step 3: Update the "rect trapdoor" test (~L259–L265)**

Replace:

```ts
// Drag anchor 0 (top-left corner at (0,0)) down by 5 units.
dragAnchor(scratch, { sub: 0, idx: 0, dx: 0, dy: 5 });
expect(scratch.edit!.dirty).toBe(true);

// Build and apply the op.
const op = commitEditAsOp(scratch);
expect(op).not.toBeNull();
history.applyOps([op!], 'Move anchor');
```

with:

```ts
// Capture baseline first (real drag handler does this on `begin`).
// preConvert is set, so baseline = rect form → undo restores the rect.
captureGestureBaseline(scratch);
expect(scratch.edit!.preConvert).toBeNull(); // consumed by capture
expect(scratch.edit!.gestureBaseline).not.toBeNull();

// Drag anchor 0 (top-left corner at (0,0)) down by 5 units.
dragAnchor(scratch, { sub: 0, idx: 0, dx: 0, dy: 5 });
expect(scratch.edit!.dirty).toBe(true);

// Build and apply the op.
const op = commitGestureOp(scratch, 'Move anchor');
expect(op).not.toBeNull();
history.applyOps([op!], 'Move anchor');
```

- [ ] **Step 4: Search for stragglers**

Run: `grep -n "commitEditAsOp\|edit\.original\|edit!\.original" src/tools/builtin/pen/`
Expected: zero matches.

- [ ] **Step 5: Run pen edit tests**

Run: `npx vitest run src/tools/builtin/pen/usePenTool.edit.test.tsx`
Expected: all tests pass.

- [ ] **Step 6: Run the full pen test suite**

Run: `npx vitest run src/tools/builtin/pen/`
Expected: all tests pass. (`usePenTool.test.tsx` covers create-mode and shouldn't be affected.)

- [ ] **Step 7: Run the full test suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/tools/builtin/pen/usePenTool.edit.test.tsx
git commit -m "test(pen-edit): update for per-gesture commit helpers"
```

---

## Task 5: Add a regression test for per-gesture undo

**Files:**
- Modify: `src/tools/builtin/pen/usePenTool.edit.test.tsx`

**Context:** Before this change, two anchor drags in the same edit session would either become dozens of entries (current bug) or overlap each other (old `original`-based commit). Lock the corrected behavior in: two distinct anchor drags ⇒ two distinct undo entries ⇒ undoing once reverts only the second drag.

- [ ] **Step 1: Add the test**

Append a new `it(...)` block to the file, modeled on the existing "move anchor" test in shape:

```ts
it('two separate anchor drags push two separate undo entries; undo reverts only the most recent', () => {
  const objId = 'obj-multi-drag';
  const origPath = new PathBuilder()
    .moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).build();

  const { tool, adapter, history, scratch } = setupEdit({
    getPathObj: (id) => id === objId
      ? { path: origPath, closed: false, params: undefined, tool: 'pen' }
      : null,
  });

  // Enter edit mode via shift+click (no _lastClick fiddling needed).
  tool.pointer!.onClick!(pe({ shiftKey: true }), makeCtx(scratch, {
    worldX: 0,
    worldY: 0,
    target: { category: 'node', kind: 'node', id: objId } as ToolCtx['target'],
    modifiers: { shift: true, ctrl: false, alt: false, meta: false },
  }));
  expect(scratch.mode).toBe('edit');

  // Gesture A: drag anchor 1 by (0, +5).
  captureGestureBaseline(scratch);
  dragAnchor(scratch, { sub: 0, idx: 1, dx: 0, dy: 5 });
  const opA = commitGestureOp(scratch, 'Move anchor');
  expect(opA).not.toBeNull();
  history.applyOps([opA!], 'Move anchor');

  // Gesture B: drag anchor 2 by (-3, 0). Fresh baseline → from = post-A state.
  captureGestureBaseline(scratch);
  dragAnchor(scratch, { sub: 0, idx: 2, dx: -3, dy: 0 });
  const opB = commitGestureOp(scratch, 'Move anchor');
  expect(opB).not.toBeNull();
  history.applyOps([opB!], 'Move anchor');

  // Two pushes → two entries.
  expect(history.entries().undo).toHaveLength(2);
  expect(adapter.setPath).toHaveBeenCalledTimes(2);
  const afterB = adapter.setPath.mock.calls[1][1] as { path: PolygonPath };

  // Undo once → reverts to post-A state, NOT origPath.
  history.undo();
  expect(adapter.setPath).toHaveBeenCalledTimes(3);
  const afterUndoB = adapter.setPath.mock.calls[2][1] as { path: PolygonPath };
  expect(Array.from(afterUndoB.path.coords)).not.toEqual(Array.from(afterB.path.coords));
  expect(Array.from(afterUndoB.path.coords)).not.toEqual(Array.from(origPath.coords));

  // Undo again → reverts to origPath.
  history.undo();
  expect(adapter.setPath).toHaveBeenCalledTimes(4);
  const afterUndoA = adapter.setPath.mock.calls[3][1] as { path: PolygonPath };
  expect(Array.from(afterUndoA.path.coords)).toEqual(Array.from(origPath.coords));
});
```

If the existing test helper `pe()` / `makeCtx()` don't accept a `modifiers` override on the ctx, fall back to dispatching the shift-click via whatever the existing "shift+click enters edit" test (the `it('shift+click on a path obj enters edit ...'` at ~L288) uses — copy its entry pattern. The point of this test is the two-drag/two-entry/correct-undo behavior, not the entry path.

- [ ] **Step 2: Run the new test**

Run: `npx vitest run src/tools/builtin/pen/usePenTool.edit.test.tsx -t "two separate anchor drags"`
Expected: PASS.

- [ ] **Step 3: Run the full pen suite**

Run: `npx vitest run src/tools/builtin/pen/`
Expected: all pass.

- [ ] **Step 4: Final typecheck + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/pen/usePenTool.edit.test.tsx
git commit -m "test(pen-edit): lock in per-gesture undo granularity"
```

---

## Task 6: Manual smoke + prepublish gate

**Files:** none (verification only).

- [ ] **Step 1: Spin up the draw app and exercise path edit**

Start the dev server in the background (from repo root): `npm --workspace apps/draw run dev` in a background shell. Note the URL it prints.

Manual checklist in the browser:
1. Draw a path with the pen tool, then double-click it to enter edit mode.
2. Drag one anchor. Release. Undo. The anchor should jump back to its pre-drag position in ONE undo press.
3. Drag a different anchor. Release. Drag a third. Release. Press undo twice. Both drags reverse one at a time (last-in-first-out).
4. Alt-click on a segment to add an anchor. Undo. The anchor disappears.
5. Drag a handle. Undo. The handle returns.
6. Select an anchor, press the arrow keys a few times. Undo once per press.
7. Exit edit mode (Escape or click empty). The path-edit modality's `commit` squashes per-gesture entries into one outer "path-edit" entry — outer undo (after exit) should revert the whole session in one step.

- [ ] **Step 2: Run the release-gate command**

Run: `npm run prepublishOnly`
Expected: tsc + vitest + tsup build all pass.

- [ ] **Step 3: Stop the dev server**

Kill the background dev-server shell.

---

## Notes for the executor

- The implementation order matters: Task 1 introduces the new helpers and breaks call sites; Tasks 2–3 fix those call sites; Task 4 fixes the tests. Don't try to typecheck after Task 1 in isolation and panic — there *will* be errors until Tasks 2–3 land.
- The `dirty` flag on `PenEditState` is left alone. It still flips to `true` on any anchor/handle mutation (via the `actions.ts` helpers). We use it as a no-op suppressor inside `commitGestureOp` — a captured baseline plus zero mutation → no op pushed.
- Don't reintroduce `coalesceKey` on the SetPathOp. The whole point is per-gesture entries that do NOT merge across gestures.
- If `npm run prepublishOnly` fails on something unrelated to pen edit (e.g., a pre-existing typing issue elsewhere), surface that as out-of-scope — do not patch unrelated code.
