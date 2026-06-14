# Registry unification — Phase 12: route-table retirement + ResizeAnchor plumb

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

> **Note:** This plan supersedes an earlier narrower draft that covered only the ResizeAnchor wiring. The full Phase 12 scope (per the `docs/TODO.md` line 367 blocker note) also covers route-table retirement across all builtin tools and the kit-standard descriptors' keystroke migration.

**Goal:** Cut the load-bearing remnants of the legacy interaction system so Phase 14e's bulk deletion becomes mechanical. Two threads:

1. **Anchor plumb.** Wire `ResizeAnchor` from affordance classification through `InvocationCtx` so `resizeAction` (currently `PARTIAL` per Phase 11) can become `REAL` and the legacy `useResize`-via-route-table fallback in useSelectTool can be removed.
2. **Route table retirement.** Empty out useSelectTool's `routes` field entirely; unwind in-tool imports of legacy hooks (`useMove`/`useResize`/`useRotate`/`useAreaSelect`/`useInsert`/`useClone`/`useLassoSelect`/`useEditAnchors`) across every builtin tool. Migrate kit-standard immediate-action descriptors from `defaultBinding: KeyBinding` to `gestureBinding: GestureSpec`. Switch `ActionBar` + tests off `action.run` to `action.invoker.run` (or `registry.fire`).

**Architecture:** No new abstractions. Connective tissue + deletions. Tasks must be sequenced: keystroke migration depends on ActionBar/test migration, deletion-readiness depends on all callers being moved off the legacy paths.

**Tech Stack:** TypeScript, React, Vitest. Builds on Phases 1–14d + dispatcher-fallthrough.

---

## Why this is a single plan, not multiple

The six tasks share a single failure mode: half-doing any one of them leaves a legacy hook load-bearing, which blocks Phase 14e. Doing them as one plan lets a single executor keep the whole story in head and verify continuously with `npm run prepublishOnly` after each task.

## File map

**Modify:**
- `src/interactions/actions/invoker.ts` — `AffordanceHit` gains typed `anchor?: ResizeAnchor`.
- `src/canvas/affordanceAt.ts` — populate `anchor` when classifying corner-handle hits.
- `src/interactions/actions/defaults/resize.ts` — invoker reads `ctx.drag.affordance.anchor`; flip from PARTIAL to REAL.
- `src/tools/builtin/useSelectTool/useSelectTool.ts` — delete `routes` table; remove legacy hook imports.
- `src/tools/builtin/useRotateTool/useRotateTool.ts`, `src/tools/builtin/useCloneTool/useCloneTool.ts`, `src/tools/builtin/useLassoTool/useLassoTool.ts`, `src/tools/builtin/useEditAnchorsTool/useEditAnchorsTool.ts`, `src/tools/builtin/useTextTool/useTextTool.ts` — drop legacy hook imports; rely on `Tool.bindings`.
- `src/interactions/actions/defaults/{escape,selectAll,delete,duplicate,group,ungroup,undoRedo,flip,nudge,reorder}.ts` — switch from `defaultBinding: KeyBinding` to `gestureBinding: GestureSpec`. Drop `defaultBinding`.
- `packages/ui/src/components/ActionBar/ActionBar.tsx` — fire via `registry.fire(action.id, {})` (or `action.invoker.run`) instead of `action.run?.()`.
- Test files calling `action.run!()` directly — switch to dispatcher fire or `invoker.run(stubCtx)`.

**Create:** nothing.
**Delete:** nothing in this phase. Phase 14e is the deletion phase; Phase 12 only severs dependencies that prevent Phase 14e from succeeding.

## Tasks

### Task 1: Type the anchor on AffordanceHit

In `src/interactions/actions/invoker.ts`:

```ts
import type { ResizeAnchor } from '...';  // grep for the canonical type

export interface AffordanceHit {
  kind: string;
  fixedPoint?: { x: number; y: number };
  targetIds?: string[];
  /** Set when `kind` matches `'handle:...'`. Lets resizeAction skip
   *  re-parsing kind. Other affordance kinds (rotate, anchor edit) leave
   *  this undefined. */
  anchor?: ResizeAnchor;
}
```

If `ResizeAnchor` isn't on a stable internal import path, either re-export or alias-import.

### Task 2: Populate `anchor` in affordance classification

In `src/canvas/affordanceAt.ts`'s corner-handle path, set `anchor` from the corner being hit (`{ x: 'min'|'max', y: 'min'|'max' }`). The kind string (`'handle:top-left'` etc.) already encodes this — translate once at classification time so consumers don't re-parse.

### Task 3: resizeAction PARTIAL → REAL

In `src/interactions/actions/defaults/resize.ts`:

```ts
start(ctx, opts) {
  const anchor = ctx.drag?.affordance?.anchor;
  if (!anchor) return {};
  // capture origin pose(s), set up controller per existing ResizeAdapter contract
},
onMove(ctx) {
  // per-frame remap using anchor + ctx.drag.current
},
onEnd(ctx, reason) {
  // commit or restore
},
```

Mirror `moveAction` shape (Phase 6) and `useResize`-internal canonical math. Adapt to ResizeAdapter contract per Phase 8 DepRegistry adapter expectations.

Add an integration test in `src/interactions/dispatcher/resize.integration.test.tsx` that exercises the new path end-to-end without going through `useResize`.

### Task 4: Empty useSelectTool's route table

After Phases 13/14a/dispatcher-fallthrough, useSelectTool's `routes` still has:
- `drag` slot entries — suppressed by `bindingsOverrideDrag: true` but exist as dead code. **Delete.**
- `click` slot — modifier-aware no-op preservation handlers (e.g., `[mods({shift:true})]: noopPreserveSelection`). Migrate to `Tool.bindings` with `mods` populated + a `noop` actionId (add `noopAction` descriptor if missing), OR delete if dispatcher-fallthrough's specificity ordering makes them implicit. **Decision needed during execution; test selection-preservation behavior after.**
- `dblTap` slot — Phase 14a deferred. If dispatcher doesn't recognize `kind: 'doubleClick'`, time-box 30 min investigation; if larger, leave the dblTap entries with a note and ship the rest.
- `pointerDown` slot — click-vs-drag classification + deferred-collapse. Now redundant with dispatcher's threshold-based classification. Verify and delete.

After Task 4: `useSelectTool.routes` is `{}` or undefined. Delete imports of `useMove`, `useAreaSelect`.

### Task 5: Per-tool legacy-hook cleanup

For each tool, audit and remove the import:

- `useRotateTool` — `useRotate` → `Tool.bindings` + `rotateAction` (Phase 11 REAL).
- `useCloneTool` — `useClone` → `Tool.bindings` + `cloneAction` (Phase 11 REAL, Phase 14c.2).
- `useLassoTool` — `useLassoSelect` → `Tool.bindings` + `lassoSelectAction` (Phase 14b REAL).
- `useEditAnchorsTool` — `useEditAnchors` → `Tool.bindings` + `editAnchorsAction` (Phase 14b REAL, 14d wired).
- `useTextTool` — `useInsert` (or similar). Phase 14c.2 deferred. If Tool.bindings binding exists, drop import; if not, **leave a TODO and don't break the tool**.

Smoke tests + full vitest after each tool migration; behavior unchanged.

### Task 6: Kit-standard descriptors — `defaultBinding` → `gestureBinding`

Ten descriptors still set `defaultBinding: KeyBinding`:
`escape`, `selectAll`, `delete`, `duplicate`, `group`, `ungroup`, `undoRedo`, `flip`, `nudge`, `reorder`.

For each:

```ts
// BEFORE
defaultBinding: { key: 'Escape' },

// AFTER
gestureBinding: { kind: 'key', key: 'Escape' },
```

Modifier and parametric variants follow Phase 4's patterns (already established for nudge 8→4, reorder 4→2, flip 2→1). Verify each descriptor still fires under the same keystrokes (Phase 3+ already routed them; Phase 12 makes the dispatcher the only path).

### Task 7: ActionBar + tests off `action.run`

In `packages/ui/src/components/ActionBar/ActionBar.tsx`:

```ts
// BEFORE
onClick={() => action.run?.()}

// AFTER (preferred — goes through dispatcher; respects enabled() + dep resolution)
onClick={() => registry.fire(action.id, {})}
```

If `registry.fire` doesn't yet accept an empty-opts call, extend it.

Tests in `defaults/{group,delete,t8-regression}.test.ts` call `action.run!()` directly. Switch to `action.invoker.run(stubCtx, {})` (for unit-level "did the side effect happen") or `registry.fire` (for "did the action route correctly").

### Task 8: Verify + commit

`npm run prepublishOnly` green from main checkout. `npm run build:demo` green. `npm run test:stories` green if any storybook-touching changes.

Per-task commits encouraged (~8 commits, bisectable). Update `docs/TODO.md`: rewrite the Phase 10 / 12 blocker note at line 367 to read "Real deletions unblocked; proceed with Phase 14e".

## Done criteria

- `AffordanceHit.anchor?: ResizeAnchor` exists and populated for corner-handle hits.
- `resizeAction` invoker is REAL (no stub returns).
- `useSelectTool.routes` is empty/undefined.
- No tool imports `useMove`/`useResize`/`useRotate`/`useAreaSelect`/`useInsert`/`useClone`/`useLassoSelect`/`useEditAnchors`.
- All kit-standard descriptors use `gestureBinding`, not `defaultBinding: KeyBinding`.
- ActionBar fires through `registry.fire` or `invoker.run`, not `action.run`.
- All tests pass; tsc clean; build:demo green.
- Phase 14e becomes a mechanical grep-and-delete sweep.

## Risks

- **AffordanceHit.anchor shape.** `ResizeAnchor` may be `{ x, y }` or a string. Pick whichever is already canonical; don't introduce a new shape.
- **Modifier-aware click no-ops in useSelectTool.** Phase 14a left `[mods({shift:true})]: noopPreserveSelection` because no migration target existed. If dispatcher-fallthrough's specificity ordering doesn't make these implicit (shift-click without a binding falls through to `clearSelection` and breaks selection), add explicit `actionId: 'noop'` bindings.
- **dblTap migration.** If dispatcher doesn't recognize `kind: 'doubleClick'`, that's a real extension. Time-box 30 min; if bigger, leave dblTap on the route table with a clear note and ship the rest.
- **`action.run` test rewrites are tedious.** Don't over-rewrite — if a test asserts "side effect happened," `invoker.run(stubCtx)` is fine; if it asserts registry behavior, go through `registry.fire`.

## What's next

Phase 14e (legacy bulk deletion) becomes a green-light grep-and-delete sweep. Then Phase 14f (the cosmetic rename) follows.
