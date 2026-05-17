# Registry unification — Phase 14a: clearSelection + ClickSpec classification + Phase 13 carryforward

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the simplest portion of useSelectTool's click route (click-on-empty-clears-selection) to a `Tool.bindings` entry backed by a new `clearSelection` action descriptor. Add `ClickSpec` target classification to the dispatcher (mirroring what Phase 13 did for DragSpec). Resolve Phase 13 carryforward items: register the `areaSelect` dep in `useStandardActions`, audit `clientToWorld` correctness at non-unit-scale.

**Architecture:** Two new descriptors (`clearSelection`, `forwardClick` — possibly), `ClickSpec` becomes meaningful for target classification, useSelectTool's `click: { empty: { [mods()]: clearOnEmpty } }` route migrates. The more complex click logic (`collapseDeferredClick`, modifier-aware preservation) stays on the route table for now — those are tool-internal state-machine concerns better served by Phase 14b's deeper restructure.

**Scope explicitly excludes** dblTap migration and `collapseDeferredClick` (kept on route table). The current route table's click + dblTap routes coexist with the new binding.

**Tech Stack:** TypeScript, React, Vitest. Builds on Phases 1–13.

---

## File map

**Create:**
- `src/interactions/actions/defaults/clearSelection.ts` + test — immediate action whose invoker calls `selection.set([])`.

**Modify:**
- `src/interactions/dispatcher/matcher.ts` — `ClickSpec` target classification mirrors Phase 13's `DragSpec` work (uses `classifyTarget` thunk + bodyTarget on InputEvent.click).
- `src/interactions/dispatcher/useGestureDispatcher.tsx` — pack click events with `bodyTarget` populated.
- `src/interactions/actions/useStandardActions.ts` — register `clearSelection` descriptor; wire `areaSelect` dep source.
- `src/canvas/SceneCanvas.tsx` — source the `areaSelect` dep for `useStandardActions` (an `AreaSelectDep` instance constructed from scene + selection).
- `src/tools/builtin/useSelectTool/useSelectTool.ts` — add `Tool.bindings` entry for `clearSelection`. Add `bindingsOverrideClick?: boolean` flag if needed (mirror Phase 13's drag-override pattern) — though for now the route table can simply remove its empty-no-mods entry instead of needing a flag.

## Scope boundaries

- ONE new click descriptor (`clearSelection`).
- ClickSpec target classification — uses existing classifyTarget thunk; no new infrastructure.
- areaSelect dep wiring — small task, just plumbing.
- clientToWorld audit — verify correctness; fix only if a bug surfaces.
- Doesn't migrate `collapseDeferredClick`, modifier-aware click preservation, or dblTap routes.
- Doesn't add `Tool.bindingsOverrideClick` flag unless absolutely necessary.

## Tasks

### Task 1: ClickSpec target classification + bodyTarget on InputEvent.click

Mirror Phase 13's DragSpec work. The dispatcher's pointerdown handler already populates `bodyTarget` for drag events; the click handler (pointerup-without-movement-threshold-cross) needs the same.

Read `useGestureDispatcher.tsx` to find where click events are synthesized. Add `bodyTarget` population from `classifyTarget(worldPoint)`. Read the matcher to see how Phase 13 handles drag-target classification; mirror for click.

### Task 2: `clearSelection` descriptor

```ts
export const clearSelectionAction: Action = {
  id: 'clearSelection',
  label: 'Clear selection',
  // No defaultBinding — this fires only via Tool.bindings on useSelectTool.
  requires: ['selection'] as const,
  invoker: {
    timing: 'immediate',
    run: ({ selection }) => selection.set([]),
  },
  enabled: ({ selection }) => selection.get().length > 0 ? true : ActionDisabledReason.SelectionRequired,
};
```

Note: this descriptor uses `({ selection })` deps signature; Action.enabled is zero-arg in practice (per Phase 7 findings). Use the same workaround as other descriptors — accept the typed deps in the invoker; provide a static-placeholder enabled.

### Task 3: useStandardActions registration

Add to `KIT_STANDARD_DESCRIPTORS`. Bump count 38 → 39.

### Task 4: Wire `areaSelect` dep source

Phase 13 added `areaSelect: AreaSelectDep` to DepSchema. Phase 11 created `areaSelectAction` that requires it. But useStandardActions doesn't register a source.

In `<SceneCanvas>`'s `StandardActionsRegistrar` (or wherever the dep sources are wired), construct an `AreaSelectDep` from the scene + selection:

```ts
const areaSelectDep: AreaSelectDep = {
  hitTestArea: (bounds, mode) => scene.hitTestArea(bounds, mode),  // verify scene has this
  getSelection: () => selection.current,
  setSelection: (ids) => selection.set(ids),
};
useDepSource('areaSelect', () => areaSelectDep);
```

If `scene.hitTestArea` doesn't exist, find the equivalent in the kit (likely in chrome state or a sceneAdapter). Map it.

Same for `insert` dep (also Phase 11/13 added but not wired). Construct an `InsertDep` from the scene's insert primitives. If no clean source exists, document and defer.

### Task 5: useSelectTool — add clearSelection binding

```ts
bindings: [
  // ... existing Phase 13 drag bindings ...
  // NEW: click-on-empty (no modifiers) → clearSelection
  { spec: { kind: 'click', target: 'empty', mods: {} }, actionId: 'clearSelection' },
],
```

ALSO: remove the equivalent entry from useSelectTool's route table (`click: { empty: { [mods()]: clearOnEmpty } }`) to avoid double-firing.

Keep the modifier-aware shift/mod/mod+shift entries on the route table (preserve-selection no-ops) — those are still route-table territory until Phase 14b.

### Task 6: Integration test

Extend `SceneCanvas.useSelectTool.integration.test.tsx` (or add a new file) — click on empty (no mods) clears selection; click on selected body doesn't (route-table `collapseDeferredClick` handles); shift-click on empty doesn't (no-op).

### Task 7: clientToWorld audit (Phase 13 carryforward)

Phase 13 used `clientToWorld` to convert pointerdown coordinates for affordanceAt/classifyTarget. Phase 13's report flagged: "correct at scale=1/view.x=0; non-unit-scale needs audit."

Read the GestureDispatcherMounter implementation. Verify the conversion uses `view.scale` and `view.x/y` correctly. Write a focused test that uses a zoomed view and confirms affordance hit-testing works at scale 2x and at non-zero pan.

If a bug is found, fix it. If correct, add the test as a regression guard.

### Task 8: Verify + TODO

prepublishOnly + build:demo green. TODO entry for Phase 14a.

## Done criteria

- `clearSelection` descriptor registered; click-on-empty fires it through the dispatcher.
- `areaSelect` (and `insert`) deps wired in SceneCanvas.
- useSelectTool's `click: empty no-mods` route entry removed (replaced by binding).
- clientToWorld verified at non-unit-scale (test added).
- All tests pass; tsc clean.

## Risks

- **Click vs pointerdown timing.** ClickSpec fires on pointerup-without-threshold-cross. Verify the dispatcher correctly distinguishes click from drag (drag has start→onMove→onEnd; click has start→onEnd-without-onMove).
- **collapseDeferredClick coupling.** If clearOnEmpty removal accidentally breaks the deferred-collapse logic (the deferred mechanism may depend on a specific sequence of route-table firings), revert and document.
- **insert dep wiring complexity.** The insert adapter needs per-tool node factories. If too tangled for Phase 14a, defer insert dep wiring to Phase 14b.

## What's next

Phase 14b — migrate per-tool route tables (useRectTool, useEllipseTool, useTextTool, etc.) to bindings. Each tool's drag-insert pattern can use the now-real insertAction. Once all tools migrate, Phase 14c deletes legacy hooks.
