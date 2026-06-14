# Selection-Aware Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `cloneSelection` option to `useCloneTool` so alt-dragging any selected item clones the whole selection.

**Architecture:** Single option on `useCloneTool` resolved at `drag.onStart`: if `true` and the hit id is in `adapter.getSelection()`, pass the full selection to `clone.start`; otherwise pass `[hit]`. No changes to `useClone`, `cloneByAltDrag`, or the adapter contract — those already accept arrays.

**Tech Stack:** TypeScript, React, Vitest + React Testing Library, weasel kit.

**Spec:** `docs/superpowers/specs/2026-05-11-clone-selection-aware-design.md`

---

## File map

- Modify: `src/tools/builtin/useCloneTool.ts` — new option, branch in `drag.onStart`.
- Modify: `src/tools/builtin/useCloneTool.test.tsx` — five new tests.
- Modify: `demo/demos/CloneDemo.tsx` — wire `useSelection`, `useSelectTool`, pass `cloneSelection: true`.
- Modify: `docs/TODO.md` — strike Tier 1.5 entry.

---

## Task 1: Hook plumbing + tests (TDD)

**Files:**
- Modify: `src/tools/builtin/useCloneTool.ts`
- Test: `src/tools/builtin/useCloneTool.test.tsx`

- [ ] **Step 1.1: Read the existing test file**

Read `/Users/mike/src/weasel/src/tools/builtin/useCloneTool.test.tsx` to understand:
- How the mock adapter is wired (look for `makeAdapter` or similar).
- How a drag is simulated (look for calls into `tool.drag.onStart` / `onMove` / `onEnd`, or the dispatcher).
- The shape of `commitPaste` in the mock (it returns the cloned objects).

You will mimic that exact harness for the new tests.

- [ ] **Step 1.2: Write the failing tests**

Append five tests to `useCloneTool.test.tsx`. Names and intent:

```ts
it('cloneSelection=false: clones just the hit even when hit is selected', () => {
  // Setup adapter with selection ['a','b','c'], hit = 'a'.
  // Run useCloneTool({ behaviors: [cloneByAltDrag()] }) — cloneSelection omitted (default false).
  // Simulate alt-drag onDown→onStart at coords inside 'a'.
  // Assert commitPaste was called with a snapshot of exactly ['a'].
});

it('cloneSelection=true: hit in selection → clones the whole selection', () => {
  // Setup adapter with selection ['a','b','c'], hit = 'a'.
  // Run useCloneTool({ behaviors: [cloneByAltDrag()], cloneSelection: true }).
  // Simulate alt-drag. Assert commitPaste was called with snapshot of ['a','b','c'] in that order.
  // Assert 3 InsertOps in the resulting batch.
});

it('cloneSelection=true: hit NOT in selection → clones just the hit', () => {
  // Selection ['b','c'], hit = 'a' (alt-drag a non-selected rect).
  // Assert commitPaste was called with snapshot of ['a'] only.
});

it('cloneSelection=true: empty selection → clones just the hit', () => {
  // Selection [], hit = 'a'.
  // Assert commitPaste called with ['a'].
});

it('cloneSelection=true: adapter without getSelection → clones just the hit (no crash)', () => {
  // Build an adapter whose getSelection returns [] (or omit it if your mock supports that).
  // hit = 'a'. Assert commitPaste called with ['a']; no exception.
});
```

When writing each test, model after the existing useCloneTool tests for harness (pickBest plumbing, dispatcher invocation, etc.). The `snapshotSelection` mock in the existing harness should already be recording its `ids` argument — if not, extend the harness to capture that array and assert on it.

- [ ] **Step 1.3: Run failing tests**

```
npx vitest run src/tools/builtin/useCloneTool.test.tsx
```

Expected: tests 2, 3, 4, 5 fail (test 1 may pass coincidentally since it matches today's behavior).

- [ ] **Step 1.4: Add option + branch**

In `src/tools/builtin/useCloneTool.ts`:

(a) Add to `UseCloneToolOptions` interface (after the `cursor` field around line 73):

```ts
/** When true, alt-drag clones the entire selection if the hit id is in
 *  the selection; otherwise clones just the hit (the default behavior).
 *  Matches the Figma/Illustrator alt-drag UX. Requires
 *  `adapter.getSelection()` to be implemented. Default false. */
cloneSelection?: boolean;
```

(b) Replace the body of `drag.onStart` (around lines 220-232) with:

```ts
onStart: (_e, ctx) => {
  const { pendingId, pendingMods } = ctx.scratch;
  if (pendingId === null || pendingMods === null) return 'pass';
  let ids: string[] = [pendingId];
  if (optsRef.current.cloneSelection) {
    const sel = adapterRef.current.getSelection?.() ?? [];
    if (sel.includes(pendingId)) ids = [...sel];
  }
  cloneRef.current.start(
    ctx.worldX,
    ctx.worldY,
    ids,
    optsRef.current.layer ?? 'structures',
    pendingMods,
  );
  activeRef.current = true;
  return 'claim';
},
```

- [ ] **Step 1.5: Run tests — confirm green**

```
npx vitest run src/tools/builtin/useCloneTool.test.tsx
```

Expected: all tests pass.

- [ ] **Step 1.6: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1.7: Commit**

```bash
git add src/tools/builtin/useCloneTool.ts src/tools/builtin/useCloneTool.test.tsx
git commit -m "$(cat <<'EOF'
feat(useCloneTool): cloneSelection option for selection-aware alt-drag

When cloneSelection is true, alt-dragging a selected item clones the
whole selection (Figma/Illustrator semantic); alt-dragging an
unselected item still clones just the hit. Resolved at drag.onStart by
consulting adapter.getSelection(). No changes to useClone,
cloneByAltDrag, or the adapter contract — both already accept arrays.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: CloneDemo selection wiring

**Files:**
- Modify: `demo/demos/CloneDemo.tsx`
- Modify (optional): `demo/registry.ts` description/hint copy.

The current demo uses `useScene` and a hand-rolled adapter without selection. We add `useSelection`, a `useSelectTool`, and enable `cloneSelection: true`.

- [ ] **Step 2.1: Read the current demo**

Read `/Users/mike/src/weasel/demo/demos/CloneDemo.tsx` and `/Users/mike/src/weasel/demo/demos/ClipboardDemo.tsx` (the latter is the reference for `useSelection` + `useSelectTool` wiring on top of `arrayAdapter` / scene).

- [ ] **Step 2.2: Wire selection, select tool, and the option**

Update `CloneDemo.tsx`:

- Import `useSelection`, `useSelectTool`, `useTools` from `@weasel-js/core`.
- Inside the component:
  - `const selection = useSelection({ mode: 'multi', extend: 'shift' });`
  - Spread `selection.adapterMethods` onto the adapter object so `getSelection` / `setSelection` resolve to the shared state.
- Add a select tool with `pickEvery` (walk `scene.renderOrder()` back-to-front and AABB-test the rect; mirror ClipboardDemo's pickEvery logic). Build `useTools({ active: 'select', registry: { select, clone } })`.
- Pass `cloneSelection: true` to `useCloneTool`.
- Update the `<SceneCanvas>` props to thread `selection` and `tools`. Use `selectionMode="multi"` if needed. Model on AlignDistributeFlipDemo.tsx for the `<SceneCanvas>` prop set.

(Concrete code shape — adapt to what compiles against the current API.)

```tsx
const selection = useSelection({ mode: 'multi', extend: 'shift' });

const adapter = useMemo(() => ({
  // ...existing adapter methods...
  ...selection.adapterMethods,
}), [scene, selection.adapterMethods]);

const pickEvery = (worldX: number, worldY: number): string[] => {
  const hits: string[] = [];
  for (const id of scene.renderOrder()) {
    const n = scene.get(id);
    if (!n) continue;
    const p = n.pose as Rect;
    if (worldX >= p.x && worldX <= p.x + p.width
        && worldY >= p.y && worldY <= p.y + p.height) hits.push(id);
  }
  return hits;
};
const boundsOf = (id: string) => {
  const n = scene.get(asNodeId(id));
  if (!n) return null;
  const p = n.pose as Rect;
  return { x: p.x, y: p.y, width: p.width, height: p.height };
};

const select = useSelectTool(adapter, { pickEvery, boundsOf, getSelection: () => selection.current });
const clone = useCloneTool(adapter, {
  behaviors: [cloneByAltDrag()],
  drawOne: drawRect,
  cloneSelection: true,
});
const tools = useTools({ active: 'select', registry: { select, clone } });

return (
  <SceneCanvas
    width={W} height={H}
    className="ckd-canvas"
    scene={scene}
    selection={selection}
    selectionMode="multi"
    tools={tools}
    layers={{ scene: { drawOne: ... } }}
  />
);
```

If `<SceneCanvas>` doesn't accept some props or accepts different names, adjust by reading `src/canvas/SceneCanvas.tsx` (or wherever it's defined) — same approach as ClipboardDemo.

- [ ] **Step 2.3: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors. If errors, adjust the `<SceneCanvas>` props to match the actual API.

- [ ] **Step 2.4: Verify in browser (manual)**

Dev server is at `http://localhost:5173/weasel/#clone`. The controller will verify this — the subagent can stop after typecheck passes.

- [ ] **Step 2.5: Commit**

```bash
git add demo/demos/CloneDemo.tsx
git commit -m "$(cat <<'EOF'
demo(CloneDemo): wire selection + cloneSelection: true

Click + shift-click to multi-select. Alt-drag any selected rect to
clone the whole selection. Exercises the new useCloneTool
cloneSelection option end-to-end with useSelection + useSelectTool.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: TODO bookkeeping

- [ ] **Step 3.1: Strike entry**

In `docs/TODO.md`, find the Tier 1.5 line beginning `- **\`selectionClone\` variant`. Replace the entire bullet with:

```
- [x] **`selectionClone` variant (alt-drag clones the entire selection).** *Shipped 2026-05-11.* `useCloneTool` gains `cloneSelection?: boolean` (default false). When true, alt-dragging any selected item clones the whole selection; alt-dragging an unselected item still clones just the hit (Figma/Illustrator UX). Demo: `demo/demos/CloneDemo.tsx` (`#clone`). Spec: `docs/superpowers/specs/2026-05-11-clone-selection-aware-design.md`. Plan: `docs/superpowers/plans/2026-05-11-clone-selection-aware.md`.
```

- [ ] **Step 3.2: Commit**

```bash
git add docs/TODO.md
git commit -m "$(cat <<'EOF'
docs(TODO): mark selectionClone shipped

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Release-gate

- [ ] **Step 4.1: Run prepublishOnly**

```
npm run prepublishOnly
```

Expected: tsc clean, all vitest green, tsup build success.

- [ ] **Step 4.2: Report done**

One-line summary of file changes + prepublishOnly outcome.
