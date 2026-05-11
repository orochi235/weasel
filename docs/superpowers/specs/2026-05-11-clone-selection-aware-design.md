# Clone tool: selection-aware alt-drag

**Status:** design
**Tier:** 1.5 (small additive hook)
**Source TODO:** `docs/TODO.md` → "`selectionClone` variant (alt-drag clones the entire selection)"

## Problem

`useCloneTool` always clones the single hit object on alt-drag (`useCloneTool.ts:226`). Real editors (Figma, Illustrator) clone the **entire selection** when the user alt-drags any selected item — and fall back to single-item clone when the user alt-drags an unselected item.

## Goals

- Single new option on `useCloneTool` to enable selection-aware cloning.
- When enabled: alt-dragging a selected item clones every selected item as one batch; alt-dragging an unselected item clones just that item (existing behavior).
- No change to the `useClone` gesture, the `cloneByAltDrag` behavior, or the `InsertAdapter` contract — they already accept arrays.

## Non-goals

- New behavior types (e.g. `cloneSelectionByAltDrag()`). The option lives on the tool, not the behavior.
- Changing `useClone`'s gesture API (it already takes an `ids[]` at `start()`).
- A second pickBest pass to detect overlapping selected items not under the cursor.
- Cluster pose math (selection-bbox center, anchor offsets) — the behavior already routes through `commitPaste(snap, offset, { dropPoint })`, and `cloneByAltDrag` already passes the cursor as `dropPoint`. Per-adapter `commitPaste` decides whether to anchor by cluster center or per-item delta.

## API

Add one option to `UseCloneToolOptions`:

```ts
/** When true, alt-drag clones the entire selection if the hit id is in
 *  the selection; otherwise clones just the hit (the default behavior).
 *  Matches the Figma/Illustrator alt-drag UX. Requires
 *  `adapter.getSelection()` to be implemented (true for `arrayAdapter`
 *  + `selection.adapterMethods`). Default false. */
cloneSelection?: boolean;
```

No new behavior, no new exports.

## Lifecycle

Today, `useCloneTool.drag.onStart` (`useCloneTool.ts:220-232`):

```ts
onStart: (_e, ctx) => {
  const { pendingId, pendingMods } = ctx.scratch;
  if (pendingId === null || pendingMods === null) return 'pass';
  cloneRef.current.start(
    ctx.worldX, ctx.worldY,
    [pendingId],
    optsRef.current.layer ?? 'structures',
    pendingMods,
  );
  // ...
}
```

After:

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
    ctx.worldX, ctx.worldY,
    ids,
    optsRef.current.layer ?? 'structures',
    pendingMods,
  );
  // ...
}
```

Three branches when the option is `true`:

| Hit | Selection | Source ids |
|---|---|---|
| `'a'` | `['a','b','c']` | `['a','b','c']` (clone selection) |
| `'a'` | `['b','c']` | `['a']` (hit not in selection — clone just the hit) |
| `'a'` | `[]` | `['a']` (no selection — clone just the hit) |

When the option is `false` (default), behavior is identical to today.

## Files touched

- Modify: `src/tools/builtin/useCloneTool.ts` — option + branch in `drag.onStart`.
- Test: `src/tools/builtin/useCloneTool.test.tsx` — new cases.
- Demo: extend `demo/demos/CloneDemo.tsx` to wire selection (multi-mode + shift-click) and pass `cloneSelection: true`. Add a hint in the description.
- `docs/TODO.md` — strike the Tier 1.5 entry.

## Tests

In `useCloneTool.test.tsx`, add against the existing mock adapter:

1. `cloneSelection: false` (default) — alt-drag a selected rect clones just the hit; selection not consulted.
2. `cloneSelection: true`, hit is in selection of 3 → `clone.start` receives `['a','b','c']` (call `commitPaste` and assert 3 created).
3. `cloneSelection: true`, hit is NOT in selection → `clone.start` receives `[hit]` only.
4. `cloneSelection: true`, empty selection → `clone.start` receives `[hit]` only.
5. `cloneSelection: true`, adapter without `getSelection` → falls back to `[hit]` only (no crash).

## Demo

Extend `CloneDemo`:
- Use `useSelection({ mode: 'multi', extend: 'shift' })`.
- Spread `selection.adapterMethods` onto the adapter.
- Wire a select tool (`useSelectTool`) so the user can click + shift-click to build a multi-selection.
- Use `useTools({ active: 'select', registry: { select, clone } })` so select is active and clone is the alt-modifier tool.
- Pass `cloneSelection: true` to `useCloneTool`.
- Update the hint copy: "Click + shift-click to multi-select. Alt-drag any selected rect to clone the whole selection."

## Done criteria

- `npm run prepublishOnly` clean.
- Manual verification: shift-select two rects, alt-drag one of them — both clones appear and follow the cursor; release → both cloned at the drop point.
- Existing useCloneTool tests still green.

## Follow-ups (defer; record only if surface friction)

- `cloneSelection: 'always'` — clone selection even when the hit is not in selection. Skip until a real consumer wants the non-Figma semantic.
- Selection-aware clone in `useCloneTool` when the consumer rolls their own pickBest that returns a non-selection id but selection includes some other items — the current rule keys off the hit id alone, which is correct for the Figma model.
