# Registry unification — Phase 13: useSelectTool drag migration + affordanceAt wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire `<SceneCanvas>`'s default `affordanceAt` (so resizeAction can actually fire end-to-end), then migrate `useSelectTool`'s **drag** route specifically to use `Tool.bindings` + the new dispatcher. Click + dblTap routes stay on the existing declarative route tables — those need their own action descriptors first (Phase 14 territory).

**Architecture:** Three threads:

1. **`affordanceAt` wiring** — SceneCanvas walks the current selection's bounds + handle positions, returns `AffordanceHit` for pointerdown locations near handles. Resize/rotate actions get a real signal; other drags get `null` (treated as "no affordance — could be a body drag").

2. **Drag target classification** — Phase 3's dispatcher matcher stubbed string-form targets (`'empty'`, `'selected-body'`, etc.) as always-false. Phase 13 makes them real: SceneCanvas-side classifier inspects the pointerdown world point against selection bounds + scene hit-test, returns a target classifier the dispatcher uses.

3. **useSelectTool drag migration** — useSelectTool's `drag: { '*': beginMove, empty: ... }` route table is suppressed via a new opt-in flag (`Tool.bindingsOverrideDrag`). The tool now declares `Tool.bindings` for drag-on-body→move, drag-on-empty→areaSelect, drag-on-handle→resize, drag-on-rotation-handle→rotate. Click and dblTap routes stay on the route table.

**Tech Stack:** TypeScript, React, Vitest. Builds on Phases 1–12.

---

## Coexistence strategy

Today, both dispatchers fire on every pointerdown:
- **Old route-table dispatcher** runs useSelectTool's route table (beginMove etc.).
- **New GestureSpec dispatcher** matches the active tool's `Tool.bindings` (if any).

For drag, both firing = double-application of the move/resize/etc. ops.

Solution: `Tool.bindingsOverrideDrag?: boolean` flag. When true on the active tool, the old route-table dispatcher's `drag` channel is suppressed (the dispatcher walks the bindings via the new path instead). Click + dblTap continue to fire via the route table.

After Phase 14 migrates click + dblTap routes to descriptors too, the route-table dispatcher's slot mechanics can fully retire.

## File map

**Modify:**
- `src/canvas/SceneCanvas.tsx` — wire default `affordanceAt` (walks chrome state's selection bounds + handles).
- `src/interactions/dispatcher/matcher.ts` — real target classification (replaces Phase 3 stubs).
- `src/interactions/dispatcher/useGestureDispatcher.tsx` — accept a `classifyTarget?: (point, view) => TargetClassification` option.
- `src/tools/types.ts` — add `bindingsOverrideDrag?: boolean` to `Tool`.
- `src/tools/dispatcher.ts` — when active tool has `bindingsOverrideDrag: true`, skip its drag-slot logic.
- `src/tools/builtin/useSelectTool/useSelectTool.ts` — declare `Tool.bindings` for drag + set `bindingsOverrideDrag: true`. Keep route table for click + dblTap.

**Create:**
- `src/canvas/affordanceAt.ts` — chrome-state-based affordance classifier.
- `src/interactions/dispatcher/targetClassifier.ts` — target classification helper.
- `src/canvas/SceneCanvas.useSelectTool.integration.test.tsx` — end-to-end test that drag-on-body fires moveAction; drag-on-empty fires areaSelectAction; drag-on-handle fires resizeAction.

## Scope boundaries

- Drag route only — click + dblTap stay on route table.
- Only useSelectTool migrated; other tools (useRectTool, etc.) stay on route tables.
- Doesn't delete useMove/useResize/useRotate hooks (Phase 14).
- Doesn't migrate non-drag actions to descriptors (click, dblclick = Phase 14+).

## Tasks

### Task 1: SceneCanvas affordanceAt + classifyTarget wiring

Add the `affordanceAt` thunk to SceneCanvas, sourced from the chrome state (the current selection's bounds + standard handle positions). Pass to useGestureDispatcher.

Add a `classifyTarget` thunk that returns `'empty' | 'selected-body' | 'unselected-body'` based on hit-testing the scene at the pointerdown world point against the current selection.

### Task 2: Matcher uses real target classification

Phase 3's matcher had `matchTarget` returning false for string-form targets. Now it consumes the `classifyTarget` result that the dispatcher passes into the matcher.

### Task 3: Tool.bindingsOverrideDrag flag

Add the flag. Old tool dispatcher checks it before firing drag-slot logic.

### Task 4: useSelectTool drag bindings

Replace the drag route table's logic with `Tool.bindings`:
```ts
bindings: [
  { spec: { kind: 'drag', target: { kindOf: hit => hit.kind === 'handle' } }, actionId: 'resize' },
  { spec: { kind: 'drag', target: { kindOf: hit => hit.kind === 'rotate-handle' } }, actionId: 'rotate' },
  { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'move' },
  { spec: { kind: 'drag', target: 'empty' }, actionId: 'areaSelect' },
],
bindingsOverrideDrag: true,
```

Set `Tool.bindingsOverrideDrag: true` so the route table's drag entry is skipped.

### Task 5: Integration test — useSelectTool behavior preserved

A real test that mounts SceneCanvas + useSelectTool, simulates each gesture (drag-on-handle, drag-on-body, drag-on-empty, drag-on-rotation-handle), and asserts the correct action fires with correct scene mutation.

### Task 6: Verify + TODO

prepublishOnly + build:demo green. TODO note about Phase 13 shipped.

## Done criteria

- SceneCanvas wires affordanceAt + classifyTarget.
- Target classification works for `'empty' / 'selected-body' / 'unselected-body'` strings.
- useSelectTool's drag is fully handled by the new dispatcher; route table drag entry is skipped (via `bindingsOverrideDrag`).
- moveAction / areaSelectAction / resizeAction / rotateAction all fire on appropriate drags.
- All tests pass; tsc clean.
- No demo behavior regression.

## Risks

- **AffordanceHit shape vs chrome state shape mismatch.** The lift from chrome state into the affordanceAt thunk may surface naming/structure inconsistencies.
- **Target classification precision.** When pointerdown is on overlapping bodies, which is "selected"? Use existing scene-pickBest API.
- **Subtle useSelectTool behaviors.** The pointerDownBody route does click-selection logic before any drag starts. This stays on the route table for now; the bindings only kick in once a drag is established. Verify the selection-change-then-drag sequence still works.

## What's next

Phase 14 — migrate useSelectTool's click + dblTap routes; delete useSelectTool's route table entirely; delete the legacy drag hooks (useMove/useResize/useRotate/etc.).
