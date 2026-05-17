# Registry unification — Phase 12: ResizeAnchor wiring + complete resizeAction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface the "what affordance was hit on pointerdown" info to the dispatcher's `InvocationCtx`, then use it to complete `resizeAction`'s invoker. After this phase, resize is REAL via the dispatcher path; the last Phase 7 stub is filled.

**Architecture:** The dispatcher's pointerdown handler currently passes the raw DOM target into `ClickSpec`/`DragSpec` target classification. To know "this drag started on the bottom-right resize handle," it needs to consult the kit's affordance/chrome layer at pointerdown time. Extend `InvocationCtx.drag` with an `affordance?: AffordanceHit` field; populate via a small classifier on pointerdown.

`resizeAction`'s invoker reads `ctx.drag.affordance` to determine which corner is dragged + which is fixed, captures start poses, applies per-frame remap, commits at end-of-drag.

**Scope explicitly excludes** the useSelectTool route-table migration (Phase 13) and the legacy hook deletions (Phase 14). The route table continues to fire its `useResize` hook alongside the new dispatcher's resize action — they coexist redundantly until Phase 13.

**Tech Stack:** TypeScript, Vitest. Builds on Phases 1–11.

---

## File map

**Modify:**
- `src/interactions/dispatcher/matcher.ts` — extend `InputEvent.pointerdown` with `affordance?: AffordanceHit`.
- `src/interactions/dispatcher/dispatcher.ts` — pass `affordance` through into `InvocationCtx.drag`.
- `src/interactions/dispatcher/useGestureDispatcher.tsx` — classify the pointerdown event via the kit's affordance pipeline; pack into the synthesized `InputEvent`.
- `src/interactions/actions/invoker.ts` — extend `InvocationCtx.drag` with `affordance?: { kind: string; ...meta }` field.
- `src/interactions/actions/defaults/resize.ts` — fill in the invoker using affordance + scene.
- `src/interactions/actions/defaults/resize.test.ts` — extend from stub-only tests to behavior tests.
- Possibly `src/core/selection/chromeState.ts` or similar — expose an `affordanceAt(point, view) → AffordanceHit | null` helper if not present.

## AffordanceHit shape

```ts
interface AffordanceHit {
  /** Discriminator: 'handle:bottom-right' / 'handle:top-left' / 'rotate-handle' / 'anchor:idx' / etc. */
  kind: string;
  /** Optional metadata per kind. For resize handles: which corner is fixed. */
  fixedPoint?: { x: number; y: number };
  /** Which node(s) the affordance belongs to. */
  targetIds?: string[];
}
```

The exact shape depends on what `chromeState` / `useSelectTool` exposes today. Read carefully.

## Steps

### Task 1: Extend InvocationCtx + dispatcher

Add `affordance?: AffordanceHit` to `InvocationCtx.drag`. Pass it through from the dispatcher's pointerdown handling.

If the dispatcher's React seam (`useGestureDispatcher`) doesn't yet have access to the affordance pipeline, it needs a thunk option (e.g., `affordanceAt?: (point, view) => AffordanceHit | null`) that consumers (`<SceneCanvas>`) provide.

`<SceneCanvas>` would supply this thunk based on the active tool's affordances (today's selection handles, rotation handle, anchor dots).

### Task 2: Fill resizeAction invoker

Use the existing `useResize`'s per-frame logic as the template. Key parts:
- On start: capture start poses for selected nodes + the affordance's fixedPoint as the resize pivot.
- On onMove: for each selected node, compute new bounds via `remapBounds(startBounds, fixedPoint, ctx.drag.current)`. Apply via `scene.setPose` (or `scene.batch` at commit).
- On commit: emit single batched transform op.
- On cancel: no-op (mutations were live but inside batch undo entry).

Reference: `src/interactions/actions/defaults/move.ts` (for the scene-direct pattern) + `src/interactions/actions/resize/resize.ts` (for the remap math).

### Task 3: Integration test

`src/interactions/dispatcher/resize.integration.test.tsx` — mount dispatcher + register resizeAction + simulate pointerdown-on-handle → pointermove → pointerup → assert scene node bounds resized.

The harness needs to inject an `affordanceAt` thunk that returns a fake handle hit for the pointerdown coordinates. The integration test thus exercises the full chain: affordance → invocation ctx → invoker body → scene mutation.

### Task 4: Verify + TODO

prepublishOnly + build:demo green; TODO note about Phase 12 shipped, resize completed.

## Done criteria

- `InvocationCtx.drag.affordance` field exists + passed through dispatcher pipeline.
- `<SceneCanvas>` provides an `affordanceAt` thunk (with a sensible default that returns null when no affordance is hit).
- `resizeAction` invoker is REAL (not stub).
- Integration test passes.
- All other tests still pass; tsc clean.

## Risks

- **Affordance classification source.** Today's chrome affordances live in `useSelectTool`'s overlay. Lifting them into a kit-level classifier (`affordanceAt`) is a small refactor. If it's tightly coupled to useSelectTool's internal state, the lift may be bigger than expected.
- **Coexistence with route-table.** Route-table's resize still fires; descriptor's resize will fire alongside. Both will mutate the scene — depending on order, the result could be off by one delta. Verify behavior carefully or gate the descriptor invocation behind "is this binding registered for this tool?"
- **AffordanceHit shape.** Choose carefully — Phase 13's useSelectTool migration will rely on it.

## What's next

Phase 13 — migrate useSelectTool's drag route table to use Tool.bindings (the new dispatcher path). Resolves the route-table-vs-new-dispatcher coexistence. Will be its own plan.
