# Drag-Insert Primitive Consolidation — Design

**Status:** approved (brainstorm), pending implementation plan
**Date:** 2026-05-05
**Supersedes:** `docs/specs/2026-05-04-drag-insert-primitive-design.md` (and its plan
`docs/plans/2026-05-04-drag-insert-primitive.md`). Most of the May 4 scope already landed
(both `useInsertTool` and `useTextTool` delegate to `useInsert`, share `applyHitExistingGate`,
share `drawMarquee` + `InsertOverlayStyle`, and `useInsert` already has `pointInsert`/`clickOnly`).
This revision documents what's left and expands scope to the gesture layer.

## Problem

The May 4 work consolidated the click/threshold/InsertOp logic into `useInsert` and
extracted `applyHitExistingGate` + `drawMarquee`. Two follow-on duplications remain.

### Tool-veneer duplication

`useInsertTool.ts` and `useTextTool.ts` are each ~96 lines and share three near-identical chunks:

1. **Overlay RenderLayer factory** — both build a `RenderLayer<unknown>` whose `draw`
   reads `ctlRef.current.overlay?.bounds` and calls `drawMarquee` with style defaults
   (~15 lines × 2).
2. **Tool-record handler bodies** — `pointer.onClick` and
   `drag.onStart`/`onMove`/`onEnd`/`onCancel`, all routing through `ctl.start/move/end/cancel`
   with identical bodies modulo `applyBatch` capture (~30 lines × 2).
3. **Conditional handler registration** — text omits drag handlers when no `commitInsert`;
   insert omits `pointer.onClick` when no `pointInsert`. The "which mode are we in" check
   is duplicated.

The real differences are narrow: text synthesizes its own adapter (consumer doesn't supply
one) and threads `ctx.applyBatch` via a ref; insert takes the adapter from the consumer
and uses adapter-owned dispatch.

### Gesture-layer duplication

`useInsert` (insert/insert.ts, 234 lines) and `useAreaSelect` (area-select/areaSelect.ts, 191 lines)
share the **drag-rectangle state machine** but specialize the commit step:

- start(worldX, worldY, modifiers) → record origin + initial overlay
- move(worldX, worldY, modifiers) → recompute bounds, update overlay
- end()/cancel() → cleanup + fire commit

`useInsert` commits via `commitInsert(bounds)`/`pointInsert(start)` → InsertOp. `useAreaSelect`
runs a behaviors pipeline producing arbitrary `Op[]` and routes them transient (applyOps) or
non-transient (applyBatch). Different adapter shapes, different overlay payloads, different
end-time semantics — but the same scratch + bounds derivation + overlay lifecycle code lives
in both files.

Future drag-rectangle gestures (image-place, polygon-by-bounds, frame, etc.) will face the
same dilemma: copy `useInsert` and adapt, or copy `useAreaSelect` and adapt.

## Goal

Two new layers, each with a single responsibility:

1. A **gesture-layer base hook** `useDragRect` that owns the drag-rectangle state machine.
   `useInsert` and `useAreaSelect` become thin wrappers over it.
2. A **tool-veneer primitive** `defineDragInsertTool` that builds the Tool record + overlay
   for any drag-insert tool. `useInsertTool` and `useTextTool` collapse to thin wrappers
   that compose `useInsert` + `defineDragInsertTool`.

## Non-goals

- Pen / freehand path tools. State shape is anchor-list, not bounds; out of scope for
  `useDragRect`.
- A unified super-hook for tool-veneers (`useDragInsertTool` taking a discriminated config).
  Two thin wrappers read better than one fat one with conditional behavior.
- Sharing the overlay RenderLayer between rect and text. They paint differently; the
  primitive owns the RenderLayer and parameterizes via style defaults.
- Promoting `useDragRect` to a more general "drag gesture" base (the user expects this might
  be a subclass of something broader later, but the broader abstraction isn't designed yet).
- Sharing the gesture-layer machinery with non-drag-rect gestures (move, resize, rotate,
  clone, pen). They have different state shapes.
- Changing the dispatcher's gesture-routing rules.
- Migrating tests to a different framework. Existing tests stay; new tests added.

## Architecture

```
[ Tool hook (Tool veneer)        ] — useInsertTool / useTextTool / future: useImageTool, ...
[ Tool primitive (defineDragInsertTool) ] — Tool record + overlay assembly
[ Gesture wrapper (useInsert / useAreaSelect) ] — commit semantics, modifier-aware
[ Gesture base (useDragRect)     ] — drag-rectangle state machine
[ Adapter (scene mutation)       ] — applyBatch / commitInsert / area-select adapter
```

`useInsert` and `useAreaSelect` keep their public surfaces. Internally each becomes a
thin wrapper that calls `useDragRect` with lifecycle callbacks.

## Gesture base: `useDragRect`

**Location:** `src/interactions/gestures/dragRect.ts` (+ `dragRect.test.ts`). Flat file
(no subdirectory) — the user expects a more general drag-gesture base may absorb this
later, so we don't reify a folder yet.

### Public surface

```ts
export interface DragRectCtx<TScratch = unknown> {
  /** Drag origin point in world coords. Frozen at start; never updated. */
  start: { x: number; y: number };
  /** Latest pointer point in world coords. Updated each move; equals start at start/end. */
  current: { x: number; y: number };
  /** Axis-aligned bounds derived from min/max of start and current. */
  bounds: { x: number; y: number; width: number; height: number };
  /** Latest modifier snapshot. */
  modifiers: ModifierState;
  /** Per-gesture scratch slot. Wrappers can stash data here that survives across
   *  start/move/end without leaking into the public controller surface. Cleared
   *  on each new gesture. Typed via the hook's TScratch generic. */
  scratch: TScratch;
}

export interface DragRectEndCtx<TScratch = unknown> extends DragRectCtx<TScratch> {
  /** True when bounds.width <= minBounds.width OR bounds.height <= minBounds.height.
   *  Wrappers consume this to distinguish click-vs-drag releases. */
  wasSubThreshold: boolean;
}

export interface UseDragRectOptions<TScratch = unknown> {
  /** Threshold for sub-threshold detection. Default { width: 0, height: 0 } (no
   *  threshold; nothing is sub-threshold unless both axes are exactly zero). */
  minBounds?: { width: number; height: number };
  /** Initial scratch for each new gesture. Called at start; the returned value
   *  becomes ctx.scratch and is mutable thereafter. Default: () => ({} as TScratch). */
  initScratch?: () => TScratch;
  /** Fired after start state is recorded; before any onMove. */
  onStart?: (ctx: DragRectCtx<TScratch>) => void;
  /** Fired on every move (after start, before end). */
  onMove?: (ctx: DragRectCtx<TScratch>) => void;
  /** Fired on end. Wrapper inspects ctx.bounds / ctx.wasSubThreshold and runs
   *  its commit logic. Returning `false` reports gesture-end as not-committed
   *  (for analytics/logging via onGestureEnd); `true` or undefined reports
   *  committed. */
  onEnd?: (ctx: DragRectEndCtx<TScratch>) => boolean | void;
  /** Fired on cancel; no commit. */
  onCancel?: (ctx: DragRectCtx<TScratch>) => void;
  /** Lifecycle observers (independent of the gesture's commit semantics). */
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
}

export interface DragRectController {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  /** Returns `true` if the move was applied (gesture is active), `false` otherwise. */
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  /** Live overlay payload. `null` when no gesture in flight. */
  overlay: { start: { x: number; y: number }; current: { x: number; y: number }; bounds: { x: number; y: number; width: number; height: number } } | null;
  /** True iff overlay !== null. Convenience getter; uses fresh ref. */
  isActive: boolean;
}

export function useDragRect<TScratch = unknown>(
  options?: UseDragRectOptions<TScratch>,
): DragRectController;
```

### Behavior

- **start**: records origin, allocates `scratch` via `initScratch?.() ?? {}`, sets overlay
  to `{ start, current: start, bounds: zero }`, fires `onStart(ctx)` then `onGestureStart`.
  An in-flight gesture is replaced (its scratch is dropped, no `cancel`/`onEnd` fires —
  this matches today's behavior in both gesture hooks).
- **move**: recomputes `bounds` from start + current, updates overlay, fires `onMove(ctx)`.
  Returns `true` if active, `false` otherwise (gesture not started). No gesture-side-effects
  beyond ctx mutation.
- **end**: builds `endCtx` (extending the active ctx with `wasSubThreshold`), invokes
  `onEnd(endCtx)`. The handler's return value (`false` = not committed, anything else =
  committed) flows to `onGestureEnd(committed)`. Cleanup (overlay → null, scratch dropped,
  active flag cleared) runs after `onEnd` so the wrapper can read final state.
- **cancel**: invokes `onCancel(ctx)`, then cleanup, then `onGestureEnd(false)`.

### Out-of-scope for the base

- Behavior pipelines. `useInsert`'s `behaviors` and `useAreaSelect`'s `behaviors` are
  wrapper concerns; both wrappers iterate their own behavior list inside the lifecycle
  callbacks they pass to `useDragRect`.
- Adapter ownership. The base never sees an adapter.
- Op dispatch. The base never produces ops.
- Click-only mode. `useInsert.clickOnly` is a wrapper-level shortcut that synthesizes a
  zero-bounds end without going through `useDragRect.move` (see "useInsert reshape").

## Gesture wrapper: `useInsert` reshape

Public surface unchanged (same options, same `InsertController` shape). Implementation:

- Calls `useDragRect<UseInsertScratch>` with `minBounds` forwarded as-is and
  `initScratch: () => ({})`. (Empty scratch — `useInsert` doesn't need cross-callback state
  beyond what `useDragRect` already gives it.)
- `onStart(ctx)`: iterates `behaviors` calling `onStart(...)` on each, mapped onto a
  `GestureContext<TPose>` synthesized from `ctx`. Same shape as today.
- `onMove(ctx)`: iterates `behaviors` calling `onMove(...)`. Behaviors can mutate
  `start`/`current` via the existing return-shape protocol; the wrapper writes the result
  back onto the underlying `useDragRect` ctx via a `setStart`/`setCurrent` helper exposed by
  the base.
  - **Decision deferred to plan:** whether `useDragRect` exposes ctx-mutators on `DragRectCtx`
    directly (e.g. `ctx.setStart(p)`) or whether the wrapper bypasses the base's overlay
    update by reaching into refs. Tentative preference: expose ctx-mutators on the base, so
    the overlay always reflects the canonical bounds. Plan task fleshes this out.
- `onEnd(endCtx)`: implements today's commit logic:
  - if `clickOnly || endCtx.wasSubThreshold`: route through `pointInsert(endCtx.start)`,
    dispatch InsertOp via `applyBatch` override or `dispatchApplyBatch(adapter, ...)`.
  - else: `adapter.commitInsert(endCtx.bounds)` → InsertOp dispatch.
  - return `true`/`false` to signal commit status.
- `onCancel`: no-op beyond what the base already does.
- **`clickOnly` shortcut**: when set, `useInsert.start` calls
  `useDragRect.start` immediately followed by `useDragRect.end` synchronously. Skip
  `move`. This guarantees a sub-threshold release without depending on the dispatcher's
  pointer-up timing.

**New on the controller:**

```ts
export interface InsertController<TObject, TPose> {
  // ... existing ...
  /** True iff `pointInsert` was supplied. Surfaces to the tool-veneer primitive
   *  so it knows whether to register `pointer.onClick`. */
  readonly supportsPointInsert: boolean;
  /** True iff the consumer adapter's `commitInsert` will be invoked above
   *  threshold. False when `clickOnly` is set (no commit ever). Surfaces to
   *  the tool-veneer primitive so it knows whether to register `drag.*`
   *  handlers. */
  readonly supportsCommitInsert: boolean;
}
```

Both flags are derived from constructor options at hook-call time (not reactive — options
are captured into refs the same way the rest of the controller is).

## Gesture wrapper: `useAreaSelect` reshape

Public surface unchanged. Implementation:

- Calls `useDragRect<{}>()` with no `minBounds` (area-select has no sub-threshold concept).
- `onStart(ctx)`: iterates `behaviors`, mapping `ctx` onto a `GestureContext<AreaSelectPose>`.
- `onMove(ctx)`: iterates `behaviors.onMove`, also fires `debug.recordBounds('area-select', ctx.bounds)`.
- `onEnd(endCtx)`: iterates `behaviors.onEnd`, finds first behavior returning a non-undefined
  `Op[]`, routes per `transient`/`defaultTransient` to `adapter.applyOps` or `adapter.applyBatch`.
  Returns `true`/`false`.
- `onCancel`: no-op (today's `cancel` doesn't run any behavior hook beyond cleanup).

The `AreaSelectController` shape stays as today (no new flags needed — `useAreaSelect` has
no consumer that needs to introspect modes).

## Tool-veneer primitive: `defineDragInsertTool`

**Location:** `src/tools/builtin/defineDragInsertTool.ts`. Sibling of `useInsertTool.ts` /
`useTextTool.ts`. No subdirectory — the auxiliary `useMarqueeOverlay` hook envisioned in the
May 4 spec is dropped (it had only one call site; folded into the primitive).

### Public surface

```ts
import type { InsertController } from '../../interactions/gestures/insert/insert';

export interface DragInsertToolConfig<TObject extends { id: string }, TPose> {
  /** Tool id, e.g. 'insert' or 'text'. */
  id: string;
  /** Tool cursor while active, e.g. 'crosshair' or 'text'. */
  cursor: string;
  /** Optional keybinding registered with the tool registry. */
  keybinding?: string;
  /** The insert controller from useInsert. supportsPointInsert/supportsCommitInsert
   *  on the controller drive handler-registration conditionals. */
  controller: InsertController<TObject, TPose>;
  /** Overlay layer id, e.g. 'insert-overlay' or 'text-overlay'. Must be unique
   *  across simultaneously-mounted tools. */
  overlayId: string;
  /** Overlay layer label, e.g. 'Insert overlay' or 'Text overlay'. */
  overlayLabel: string;
  /** Default marquee paint values when overlayStyle leaves a field unset. */
  defaultStyle: { fill: string; stroke: string; dash: number[]; lineWidth: number };
  /** Consumer-supplied marquee style overrides. */
  overlayStyle?: InsertOverlayStyle;
  /** Hit-test gate (selects existing object on hit; skips insert paths). */
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
}

export interface DragInsertToolResult {
  tool: Tool<undefined>;
  /** Ref whose `.current` is the active tool ctx's `applyBatch`, or null. The
   *  primitive captures it on handler entry (pointer.onClick / drag.onStart) and
   *  clears it on end/cancel. The text wrapper reads through this ref by passing
   *  `(ops, label) => applyBatchRef.current?.(ops, label)` into useInsert's
   *  `applyBatch` option. The insert wrapper ignores the ref. */
  applyBatchRef: React.MutableRefObject<((ops: Op[], label: string) => void) | null>;
}

export function defineDragInsertTool<TObject extends { id: string }, TPose>(
  config: DragInsertToolConfig<TObject, TPose>,
): DragInsertToolResult;
```

### Behavior

- Builds `RenderLayer<unknown>` with `id: overlayId`, `label: overlayLabel`, `space: 'screen'`,
  and a `draw` that reads `controllerRef.current.overlay?.bounds` and calls `drawMarquee`
  with the consumer's `overlayStyle` and the supplied `defaultStyle`.
- Builds the Tool record:
  - Always present: `id`, `cursor`, `keybinding`, `overlay`.
  - `pointer.onClick` registered iff `controller.supportsPointInsert`. Body: gate via
    `applyHitExistingGate`; on miss, capture `ctx.applyBatch` into the ref, call
    `controller.start(worldX, worldY, modifiers)` then `controller.end()`, clear the ref,
    return `'claim'`.
  - `drag.{onStart,onMove,onEnd,onCancel}` registered iff `controller.supportsCommitInsert`.
    Bodies mirror today's `useInsertTool` (gate on `onStart`, capture/clear `applyBatch`
    around start/end, route move through `controller.move`).
- Returns `{ tool, applyBatchRef }`.

### Asymmetry absorption

The capture-and-clear is unconditional inside the primitive. The text wrapper threads
`applyBatchRef` into `useInsert`'s `applyBatch` option so commits route through the active
tool ctx. The insert wrapper just discards `applyBatchRef` — its consumer adapter's
`applyBatch` (or `dispatchApplyBatch`'s fallback) handles op dispatch and the ref is never
read. One code path, no per-wrapper conditional.

## Tool-veneer wrapper: `useInsertTool` reshape

Collapses to:

```ts
export function useInsertTool<TObject extends { id: string }, TPose>(
  adapter: InsertAdapter<TObject>,
  options: UseInsertToolOptions<TPose, TObject> = {},
): Tool<undefined> {
  const { hitExisting, overlayStyle, ...gestureOptions } = options;
  const controller = useInsert<TObject, TPose>(adapter, gestureOptions);
  const { tool } = defineDragInsertTool({
    id: 'insert',
    cursor: 'crosshair',
    controller,
    overlayId: 'insert-overlay',
    overlayLabel: 'Insert overlay',
    defaultStyle: { fill: 'rgba(127, 176, 105, 0.25)', stroke: '#7fb069', dash: [4, 4], lineWidth: 1 },
    overlayStyle,
    hitExisting,
  });
  return tool;
}
```

Public surface unchanged. ~10 lines of body.

## Tool-veneer wrapper: `useTextTool` reshape

Collapses to:

```ts
export function useTextTool<TObject extends { id: string }>(
  options: UseTextToolOptions<TObject>,
): Tool<undefined> {
  const { pointInsert, commitInsert, hitExisting, minBounds, marqueeStyle } = options;
  // applyBatchRef declared first so we can pass it into useInsert before
  // defineDragInsertTool builds it. (Pre-allocate a noop ref; defineDragInsertTool
  // will hand back a ref of its own — the wrapper takes that one as canonical
  // and discards the placeholder.) See implementation plan for the precise
  // wiring; the ergonomic is "useInsert reads applyBatch via a ref the primitive
  // owns."
  const applyBatchRef = useRef<((ops: Op[], label: string) => void) | null>(null);
  const adapter = useMemo<InsertAdapter<TObject>>(() => ({
    commitInsert: (b) => (commitInsert ? commitInsert(b) : null),
    commitPaste: () => [],
    snapshotSelection: () => ({ items: [] }),
    insertObject: () => {},
    setSelection: () => {},
    getSelection: () => [],
  }), [commitInsert]);
  const controller = useInsert(adapter, {
    pointInsert,
    clickOnly: !commitInsert,
    minBounds: minBounds ?? { width: 4, height: 4 },
    insertLabel: 'Insert text',
    applyBatch: (ops, label) => applyBatchRef.current?.(ops, label),
  });
  const { tool, applyBatchRef: primitiveRef } = defineDragInsertTool({
    id: 'text',
    keybinding: 'T',
    cursor: 'text',
    controller,
    overlayId: 'text-overlay',
    overlayLabel: 'Text overlay',
    defaultStyle: { fill: 'rgba(164, 139, 212, 0.10)', stroke: '#a48bd4', dash: [3, 3], lineWidth: 1 },
    overlayStyle: marqueeStyle,
    hitExisting,
  });
  // Mirror the primitive's ref into the wrapper-owned ref so useInsert's
  // applyBatch closure sees the same value.
  applyBatchRef.current = primitiveRef.current;
  // (Plan task: detail the ref-wiring more precisely; the goal is that
  // useInsert.applyBatch reads the same value the primitive captures.)
  return tool;
}
```

Public surface unchanged. ~25 lines of body. The `applyBatchRef` plumbing is the only
non-mechanical bit; the plan task elaborates the precise wiring (likely: primitive accepts
an optional pre-existing ref, or wrapper reads `primitiveRef` directly via a single ref
shared at construction time).

## Files touched

- **Add:**
  - `src/interactions/gestures/dragRect.ts`
  - `src/interactions/gestures/dragRect.test.ts`
  - `src/tools/builtin/defineDragInsertTool.ts`
  - `src/tools/builtin/defineDragInsertTool.test.ts`
- **Rewrite:**
  - `src/interactions/gestures/insert/insert.ts` (becomes `useDragRect` wrapper)
  - `src/interactions/gestures/area-select/areaSelect.ts` (becomes `useDragRect` wrapper)
  - `src/tools/builtin/useInsertTool.ts` (collapse to ~10 lines)
  - `src/tools/builtin/useTextTool.ts` (collapse to ~25 lines)
- **Update (for `supports*` flags + any minor surface changes):**
  - `src/interactions/gestures/insert/insert.test.ts` (add `supports*` assertions; keep end-to-end coverage)
  - `src/interactions/gestures/area-select/areaSelect.test.ts` (no surface change; verify behavior preservation)
  - `src/tools/builtin/useInsertTool.test.ts` (no surface change; verify behavior preservation)
  - `src/tools/builtin/useTextTool.test.ts` (no surface change; verify behavior preservation)
- **Delete:**
  - `docs/specs/2026-05-04-drag-insert-primitive-design.md` (superseded)
  - `docs/plans/2026-05-04-drag-insert-primitive.md` (superseded)
- **Possibly modify:**
  - `src/index.ts` if `defineDragInsertTool` is part of the public API surface (decision
    deferred to the plan; tentative answer is yes — future external drag-insert tools
    will want it).

## Testing

- **`dragRect.test.ts` (new):** lifecycle (start/move/end/cancel ordering), bounds
  derivation (axis-aligned min/max from start + current), `wasSubThreshold` flag (above
  threshold, exactly at threshold treated as sub-threshold per current `<=` semantics, far
  below), scratch slot (`initScratch` invoked once at start, mutations preserved across
  callbacks, dropped at cleanup), overlay state transitions (null → set → null), `move`
  return value (false before start, true while active, false after end), restart-while-active
  (drops in-flight scratch without firing onEnd/onCancel — matches today's gesture-hook
  behavior), `onGestureStart`/`onGestureEnd(committed)` lifecycle observers fire correctly.
- **`insert.test.ts` (preserve + augment):** all existing cases (rect-insert, `pointInsert`
  fallback, `clickOnly`, `applyBatch` override, behaviors pipeline) keep passing unchanged
  — they validate that `useInsert` over `useDragRect` preserves end-to-end behavior. Add
  cases asserting `controller.supportsPointInsert` / `controller.supportsCommitInsert`
  reflect option configuration.
- **`areaSelect.test.ts` (preserve):** all existing cases (behaviors pipeline, transient,
  applyBatch routing, debug sink, shift modifier, abort on undefined-from-behavior) keep
  passing unchanged.
- **`defineDragInsertTool.test.ts` (new):** Tool record assembly (id/cursor/keybinding/overlay
  set correctly), conditional handler registration (`pointer.onClick` only when
  `supportsPointInsert`; `drag.*` only when `supportsCommitInsert`), overlay draw delegates
  to `drawMarquee` with merged style, hitExisting gate runs at top of both `onClick` and
  `onStart`, `applyBatchRef` captures on entry and clears on end/cancel.
- **`useInsertTool.test.ts` / `useTextTool.test.ts` (preserve):** existing behavior cases
  unchanged — they validate the wrappers preserve their public surfaces.
- **Integration:** `swillustratorDemo.integration.test.tsx` and the demo apps exercise
  both paths in real DOM — behavioral regressions surface there.

## Migration

- Swillustrator was already migrated as part of the May 4 work. No further consumer changes.
- No version-bump considerations (pre-release).

## Risks

- **Wrapper-base ctx-mutator API.** Behaviors in `useInsert` mutate `start`/`current`
  during `onMove` (e.g., shift-snap behavior re-anchors the start point). The base hook has
  to expose ctx-mutators that update its internal scratch + overlay so the next `move`
  computes from the latest start. Mitigation: spec-time decision tentative ("ctx-mutators
  on `DragRectCtx`"); plan elaborates exact API and adds a dedicated test in
  `dragRect.test.ts` exercising start-mutation mid-gesture.
- **`applyBatchRef` wiring**. The text wrapper needs `useInsert.applyBatch` and the
  primitive's capture/clear to read/write the same ref. Two possible mechanics:
  (a) primitive returns `applyBatchRef`; wrapper uses it directly when constructing
  `useInsert`'s option (closure reads the primitive's ref);
  (b) primitive accepts an optional pre-existing ref; wrapper passes its own.
  Plan picks one and adds a regression test asserting that an InsertOp from a
  text-tool click lands via `ctx.applyBatch` (text-tool history integration).
- **Behavior preservation across the gesture-layer refactor.** Both `useInsert` and
  `useAreaSelect` are mature with rich tests. The base extraction has to preserve every
  observable (overlay shape, behaviors return-protocol, applyBatch routing, debug sink,
  cancel-vs-abort distinction). Mitigation: existing tests stay end-to-end and don't
  change; any regression surfaces immediately.
- **The dispatcher routes plain clicks to `pointer.onClick` only when no drag handlers
  are registered.** The text tool's "click-only mode" relies on this — when `commitInsert`
  is omitted, drag handlers must not be registered. Captured today via
  `controller.supportsCommitInsert: false`; primitive omits `drag.*` accordingly.
  Existing behavior; carries forward unchanged.

## Out of scope (deferred to docs/TODO.md)

- A more general "drag gesture" base that subsumes `useDragRect` along with `useMove` /
  `useResize` / `useRotate`. The user expects this might exist later; not designed yet.
- Image / polygon / frame / future drag-insert tools — the primitive is built so they're
  trivial to add, but each is its own task.
- Promoting `applyHitExistingGate` to also gate the move/resize paths on the select tool
  (different responsibility, different gesture).
- Public API surface decision for `defineDragInsertTool` — the plan answers yes/no based
  on whether external consumers should be able to define drag-insert tools without going
  through the wrappers.
