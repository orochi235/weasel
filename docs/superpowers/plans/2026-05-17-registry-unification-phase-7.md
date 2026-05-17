# Registry unification — Phase 7: port remaining ongoing actions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the remaining drag-based ongoing actions to descriptors following the `moveAction` template (Phase 6 T1). `resize`, `rotate`, `areaSelect`, `insert`, `clone` migrate in this phase. `editAnchors`, `lassoSelect`, and `viewport.pinchZoom` are deferred to a separate Phase 7.5 because each requires non-trivial dispatcher extensions (multi-phase gestures, polygon synthesis, multi-touch coalescing). Each ported action becomes a static descriptor with `gestureBinding: { kind: 'drag', ... }`, registered via `useStandardActions`.

**Architecture:** Mechanical replication of the Phase 6 moveAction pattern. Each existing `useX` hook (`useResize`, `useRotate`, etc.) stays alive (other code still uses them); a new `xAction` descriptor is created beside it, extracting shared per-frame logic into helpers. Tools update their bindings tables only where the new descriptor's binding conflicts with existing route-table entries (which is rare since the new bindings tend to use target classifications the route tables don't yet have).

`useSelectTool`'s drag route table is NOT migrated in Phase 7. The route-table-vs-new-dispatcher coexistence (both fire on the same pointerdown for now; the route table is authoritative for now) stays as-is until Phase 8+. The new dispatcher's actions fire alongside but the existing route table dispatches first; demos continue to work unchanged.

**Tech Stack:** TypeScript, Vitest. Builds on Phases 1–6 (especially moveAction's pattern).

---

## Prerequisites

Phase 6 must be shipped on main. Verify:
```
grep -q "moveAction" src/index.ts && grep -q "PointerMove" src/interactions/dispatcher/matcher.ts
```

## File map

**Create per ported action:**
- `src/interactions/actions/defaults/resize.ts` + test
- `src/interactions/actions/defaults/rotate.ts` + test
- `src/interactions/actions/defaults/areaSelect.ts` + test
- `src/interactions/actions/defaults/insert.ts` + test
- `src/interactions/actions/defaults/clone.ts` + test

**Modify:**
- `src/interactions/actions/useStandardActions.ts` — add 5 new descriptors to `KIT_STANDARD_DESCRIPTORS`.
- `src/interactions/actions/useStandardActions.test.tsx` — bump descriptor count 30 → 35 + add the new ids to `KIT_IDS`.
- `src/interactions/actions/defaults/index.ts` — export 5 new descriptors.
- `src/index.ts` — barrel-export 5 new descriptors.

**Not modified in Phase 7:**
- `useResize`, `useRotate`, etc. — the existing hooks stay (other code uses them).
- `useSelectTool` route tables — stay (Phase 8+ migration).
- `editAnchors`, `lassoSelect`, `viewport.pinchZoom` — deferred to Phase 7.5 (own plan).

## Scope boundaries

- 5 ports only (resize, rotate, areaSelect, insert, clone). The 3 deferred actions become a Phase 7.5 plan with a clear explanation of why each needs extra dispatcher work.
- No `useSelectTool` migration.
- No dispatcher pump extensions (Phase 6 already shipped pointer pump; multi-touch and key-held-with-pointer-overlap deferred to dependent phases).

---

### Pattern (mirror moveAction from Phase 6 T1)

Each ported action follows the same template. Read `src/interactions/actions/defaults/move.ts` for reference.

```ts
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

interface XScratch {
  // Whatever per-gesture state X needs (start poses, original bounds, etc.)
}

export const xAction: Action = {
  id: 'x',
  label: 'X',
  gestureBinding: { kind: 'drag', target: /* appropriate target spec */ },
  requires: ['selection', 'scene'] as const,
  invoker: {
    timing: 'ongoing',
    start: (ctx, _opts) => {
      // Capture initial state into a scratch object.
      // If preconditions fail (no selection, etc.), return {} (empty handle).
      return {
        onMove: (ctx) => {
          // Use ctx.drag.delta to compute the proposed change.
          // Apply to scene (live mutation — same pattern as moveAction).
        },
        onEnd: (_ctx, reason) => {
          if (reason === 'cancel') {
            // Restore scratch.startState
          } else {
            // Commit: usually a batched op via scene.batch(...)
          }
        },
      };
    },
  },
  enabled: ({ selection }) => /* ... */,
};
```

The target spec varies per action:
- `resize`: `{ kindOf: (hit) => /* hit is on a resize handle */ }`
- `rotate`: `{ kindOf: (hit) => /* hit is on the rotation handle */ }`
- `areaSelect`: `target: 'empty'` (drag-on-empty starts area-select)
- `insert`: `target: 'empty'` (and the actively-set tool's slot via additional check)
- `clone`: `target: 'selected-body'` + `mods: { alt: true }` (alt-drag clones)

---

### Task 1: Port `resize`

**Files:** `src/interactions/actions/defaults/resize.ts` + test.

Read `src/interactions/actions/resize/resize.ts` to understand the existing hook's logic. Note:
- The scratch state (start bounds, handle being dragged, etc.).
- The per-frame remap logic (`remapBounds(start, handle, dx, dy)` or similar).
- Op-emission timing (typically a single batched transform op at end-of-drag).
- Behaviors pipeline (snap, lockAspect, etc.).

For Phase 7 scope: skip the behaviors pipeline (Phase 7+ wires custom behaviors). The descriptor's invoker uses the bare remap logic.

For target classification: the dispatcher's `kindOf` predicate receives the pointerdown event's `target` (DOM element). Determining whether the click was on a resize handle requires inspecting the affordance hit-tester. This is harder than moveAction (which used `{ kind: 'drag' }` wildcard). For Phase 7, use a coarser target — e.g. drag with `mods: { meta: true }` placeholder — OR ship with a no-op target that always-fires and self-guards in the start body (reading the selection's affordance via the `selection` dep and checking the pointerdown location matches a handle).

Honestly assess: if target classification is genuinely hard, the descriptor ships as a no-op stub and the legacy `useResize` continues to handle resize via route tables. Phase 8+ does the real wiring once target classification matures.

**Steps:**
- [ ] Read existing useResize.
- [ ] Failing tests (descriptor shape + invoker behavior for the cases you CAN test).
- [ ] Implement (with realistic deferrals documented in JSDoc).
- [ ] Verify + commit.

```
git commit -m "feat(registry): add resizeAction descriptor (Phase 7)"
```

---

### Task 2: Port `rotate`

Same shape as Task 1. Read `useRotate`. The rotation handle target classification is similar to resize — defer if it's complex.

```
git commit -m "feat(registry): add rotateAction descriptor (Phase 7)"
```

---

### Task 3: Port `areaSelect`

Read `useAreaSelect`. Likely uses `useDragRect` internally. The target is `'empty'` (drag-on-empty).

The descriptor's invoker tracks the drag-rect bounds in scratch and calls `scene.areaSelect(bounds, mode)` (or similar) on `onMove` for live preview, then `selection.set(hitIds)` on commit. Read carefully — areaSelect has live preview semantics (highlighting candidates as the rect grows).

```
git commit -m "feat(registry): add areaSelectAction descriptor (Phase 7)"
```

---

### Task 4: Port `insert`

Read `useInsert` (drag-rect insert; used by useRectTool, useEllipseTool, etc.). The target is `'empty'`.

Insert has the additional wrinkle that it's parameterized by node-kind to insert — `useRectTool` calls `useInsert({ kind: 'rect' })`, etc. The descriptor needs `params.kind` from `BindingOpts.params` (Phase 4 T4 wiring; tools register the binding with the kind they want to insert).

For Phase 7 scope: ship a generic `insertAction` that uses `params.kind` to drive insertion. Each shape-tool (Rect, Ellipse, Line, etc.) registers an ambient binding with its kind in `params.kind`. Or, simpler: per-kind descriptor (`insertRectAction`, `insertEllipseAction`, etc.) — N actions, no params. Pick whichever fits the codebase's existing pattern.

```
git commit -m "feat(registry): add insertAction descriptor (Phase 7)"
```

---

### Task 5: Port `clone`

Read `useClone`. Alt-drag on a selected node clones it.

Descriptor binding: `gestureBinding: { kind: 'drag', target: 'selected-body', mods: { alt: true } }`. (Or `{ kindOf }` predicate form if target string-form isn't ready.)

The invoker clones the node on `start` (or on first `onMove`), then routes subsequent drag delta to the clone's pose. On commit, the clone stays at its final position. On cancel, the clone is removed.

```
git commit -m "feat(registry): add cloneAction descriptor (Phase 7)"
```

---

### Task 6: Register all 5 + barrel-export

**Files:**
- Modify: `src/interactions/actions/useStandardActions.ts` — add 5 new descriptors.
- Modify: `src/interactions/actions/useStandardActions.test.tsx` — bump count 30 → 35.
- Modify: `src/interactions/actions/defaults/index.ts` — export 5.
- Modify: `src/index.ts` — barrel-export 5.

Single commit:
```
git commit -m "feat(registry): register resize/rotate/areaSelect/insert/clone descriptors (Phase 7)"
```

---

### Task 7: End-to-end verification + TODO note

- [ ] vitest + tsc + build:demo green.
- [ ] Update `docs/TODO.md`:

```
- Phase 7 (port ongoing actions: resize/rotate/areaSelect/insert/clone): shipped 2026-05-17 — five descriptors added following the moveAction template. Tools that consume the legacy useResize/useRotate/etc. hooks unchanged. The descriptors are registered as ambient bindings via useStandardActions; coexist with the existing route-table dispatchers (which remain authoritative pre-Phase-8 for tool-scoped drags). Three actions deferred to Phase 7.5: editAnchors (multi-phase gesture needs dispatcher extension), lassoSelect (polygon-from-pointermoves synthesis), viewport.pinchZoom (multi-touch pump).
```

Update "Phases 7–10: pending" → "Phases 7.5–10: pending."

```
git commit -m "docs(todo): note Phase 7 of registry unification shipped"
```

---

## Done criteria

- 5 new ongoing-action descriptors registered.
- `useStandardActions` count bumped to 35.
- All barrel exports updated.
- vitest + tsc + build:demo green.
- Each descriptor has a working invoker (even if simplified relative to the legacy hook).
- No demo broken.

## Deferred to Phase 7.5

- `editAnchors` — multi-phase: click-anchor + drag-handle + dblclick-promote. Needs dispatcher state machine for multi-phase ongoing gestures.
- `lassoSelect` — pointermove samples accumulate into a polygon; not a simple delta. Needs dispatcher path that streams pointermove coordinates into the invoker.
- `viewport.pinchZoom` — multi-touch pump; Phase 3 stubbed multi-touch input but the pinch-specific math (centroid, spread, rotation) isn't fed into the invoker.

Phase 7.5 plan addresses each.

## Risks / open items

- **Target classification for handle drags (resize, rotate).** The dispatcher doesn't yet have a clean way to express "drag started on a resize handle." For Phase 7, accept coarser target matching + self-guard in the invoker start.
- **Live-preview semantics for areaSelect.** Marquee should highlight candidates as it grows; descriptor's onMove can call `scene.areaSelectPreview(...)` if such an API exists, or skip and only set the selection on commit.
- **Behaviors not wired.** Phase 7 descriptors don't accept opts.behaviors for snap/clamp/etc. Each action ships without behaviors; Phase 8+ adds them per-binding.
