# Drag-Insert Primitive Consolidation — Design

**Status:** approved (brainstorm), pending implementation plan
**Date:** 2026-05-04

## Problem

`useInsertTool` (rect) and `useTextTool` (text) both produce drag-to-bounds tool behaviors with InsertOp commits, but they live at different layers of abstraction:

- `useInsertTool` is a thin Tool veneer over the `useInsert` *gesture hook* (`src/interactions/gestures/insert/insert.ts`). All scratch / threshold / overlay-bounds / InsertOp dispatch lives in the gesture hook.
- `useTextTool` is monolithic — it owns the drag scratch, threshold logic, marquee overlay, InsertOp dispatch, click path, and a new `hitExisting` gate, all in one file. It does not delegate to a gesture hook.

Beyond duplication, this asymmetry means future drag-insert tools (image, polygon, etc.) face a choice: copy `useTextTool`'s monolith or reimplement the click + hit-gate features that `useInsert` doesn't have. Neither option scales.

## Goal

One kit-level primitive that both tool hooks (and future drag-insert tools) compose. The "common base" is the existing gesture hook `useInsert`, extended with click-path semantics. Both tool hooks become thin Tool veneers over it.

## Non-goals

- Pen tool consolidation. Freehand path tools have a different state shape (anchor list, not bounds) and stay separate.
- A unified super-hook (`useDragInsertTool` taking a discriminated config). Two thin wrappers reading better than one fat one with conditional behavior.
- Sharing the overlay RenderLayer between rect and text. They paint differently; sharing the data source (`controller.overlay`) is enough.
- Changing the dispatcher's gesture-routing rules.

## Architecture

The kit's existing layering stays the same:

```
[ Tool hook (Tool veneer)    ] — registers handlers with the dispatcher
[ Gesture hook (state)       ] — pure interaction state machine
[ Adapter (scene mutation)   ] — applyBatch / commitInsert
```

Today, `useTextTool` collapses the top two layers. After this work, both tool hooks sit at the top layer; both delegate to `useInsert` for state.

## Gesture-hook contract: `useInsert` extensions

Two new options on `UseInsertOptions<TPose>`:

```ts
/** Click / sub-threshold-drag fallback. When provided, a release whose
 *  bounds fall <= minBounds calls pointInsert(start) instead of aborting.
 *  Returning null aborts. The created object is dispatched as an InsertOp
 *  under the same insertLabel. */
pointInsert?: (point: { x: number; y: number }) => TObject | null;

/** Drag-disabled mode. When true, every release routes to pointInsert(start)
 *  regardless of bounds — commitInsert is never called. Used by tool hooks
 *  that wire only pointer.onClick (no marquee). */
clickOnly?: boolean;
```

Behavior changes inside `useInsert`:

- **`end()` with `pointInsert` set**: today, sub-threshold release aborts. New behavior: if bounds are sub-threshold (`width <= minBounds.width || height <= minBounds.height`), call `pointInsert(start)`. If it returns an object, dispatch InsertOp; else abort. Drag above threshold still commits via `adapter.commitInsert(bounds)` as today.
- **`end()` with `clickOnly: true`**: every release calls `pointInsert(start)`; `commitInsert` is never called. Bounds are ignored.
- **`end()` with neither**: unchanged.

Non-changes:

- Adapter contract is unchanged. `commitInsert(bounds)` is still required (rect tool keeps working untouched). Click-only consumers can pass an adapter whose `commitInsert` returns null — `clickOnly: true` guarantees it's never called.
- `start()` / `move()` signatures unchanged.
- Selection is still not the gesture hook's concern.
- Overlay drawing during sub-threshold drag is not gated. Visually invisible at click-speed.

## Tool-hook reshape: `useTextTool`

```ts
interface UseTextToolOptions<TObject extends { id: string }, TPose> {
  /** Click / sub-threshold-drag insertion. Required (text is click-first). */
  pointInsert: (point: { x: number; y: number }) => TObject | null;
  /** Optional drag-to-size path. When omitted, the tool is click-only —
   *  the gesture hook runs in clickOnly mode and no marquee draws. */
  commitInsert?: InsertAdapter<TObject>['commitInsert'];
  /** Hit-test gate consulted before insertion. On hit, selects via
   *  ctx.selection.set and skips both the click and drag paths. */
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  /** Marquee preview style (when bounds path is wired). */
  marqueeStyle?: InsertOverlayStyle;
  /** Threshold below which a drag falls back to pointInsert.
   *  Default: { width: 4, height: 4 }. */
  minBounds?: { width: number; height: number };
}
```

Implementation:

- Constructs an internal `InsertAdapter` from the consumer's `commitInsert` (or a stub `() => null` when click-only). Calls `useInsert(adapter, { pointInsert, clickOnly: !commitInsert, minBounds, ... })`.
- Wires `controller.start/move/end/cancel` to dispatcher `drag.onStart/onMove/onEnd/onCancel`, identical to `useInsertTool`.
- `pointer.onClick`: runs `applyHitExistingGate`; on miss, calls `controller.start(p, mods); controller.end()` to drive the click-as-zero-bounds-drag through the gesture hook's `pointInsert` path.
- `drag.onStart`: runs `applyHitExistingGate` first; on hit, returns `'claim'` without starting the controller.
- Tool record: `{ id: 'text', keybinding: 'T', cursor: 'text', overlay, pointer, drag? }`. Drag handlers register only when `commitInsert` is supplied (so the dispatcher routes plain clicks to `pointer.onClick` in click-only mode).
- Overlay: dashed marquee with `marqueeStyle` defaults (stroke `#a48bd4`, dash `[3, 3]`, fill `rgba(164, 139, 212, 0.10)`). Source: `controller.overlay.bounds`. Same draw shape as `useInsertTool`'s overlay, different paint defaults.

## Tool-hook reshape: `useInsertTool`

Adds two optional passthroughs forwarded to `useInsert` and the hit-existing helper:

```ts
interface UseInsertToolOptions<TPose> extends UseInsertOptions<TPose> {
  overlayStyle?: InsertOverlayStyle;
  hitExisting?: (point: { x: number; y: number }) => string | string[] | null;
  // pointInsert and clickOnly inherited from UseInsertOptions
}
```

Wiring change: `drag.onStart` runs `applyHitExistingGate` before `ctl.start`; `pointer.onClick` is added (also gated, then routes to `ctl.start; ctl.end`) only when the consumer passes `pointInsert`. Rect-tool consumers passing nothing get today's behavior.

## Shared helper: `applyHitExistingGate`

`src/tools/builtin/hitExistingGate.ts`:

```ts
import type { ToolCtx } from '../types';

export function applyHitExistingGate(
  ctx: ToolCtx<unknown>,
  hitExisting:
    | ((p: { x: number; y: number }) => string | string[] | null)
    | undefined,
): boolean {
  if (!hitExisting) return false;
  const hit = hitExisting({ x: ctx.worldX, y: ctx.worldY });
  if (!hit) return false;
  ctx.selection.set(Array.isArray(hit) ? hit : [hit]);
  return true;
}
```

Used by both tool hooks at the top of `pointer.onClick` and `drag.onStart`. Returning `true` means "I claimed; skip the rest."

## Data flow

```
pointerdown → dispatcher
  ↓ drag.onStart (or pointer.onClick on sub-threshold release)
  ↓ applyHitExistingGate(ctx, hitExisting) → true? selection.set + claim
  ↓ false? controller.start(worldX, worldY, modifiers)
pointermove → dispatcher → drag.onMove → controller.move
pointerup → dispatcher
  ↓ drag.onEnd → controller.end()
  ↓   bounds > minBounds → adapter.commitInsert(bounds) → InsertOp → ctx.applyBatch
  ↓   bounds <= minBounds && pointInsert → pointInsert(start) → InsertOp → ctx.applyBatch
  ↓   bounds <= minBounds && !pointInsert → abort
  ↓ pointer.onClick (sub-threshold, no drag handler) → ctl.start(p); ctl.end() → same end-path
```

## Testing

- **`useInsert` tests** (gesture hook): add cases for
  - `pointInsert` sub-threshold fallback returns object → InsertOp dispatched
  - `pointInsert` returns null → no dispatch, no error
  - `clickOnly: true` ignores bounds, always routes to `pointInsert`
  - `clickOnly: true` with `pointInsert` returning null → no dispatch
  - Existing rect-path tests untouched.
- **`useInsertTool` tests**: untouched (no behavior change without opt-in).
- **`useTextTool` tests**: rewritten. Cover wiring assertions:
  - Click on existing (via `hitExisting`) → `selection.set`, no insert
  - Click on empty → `pointInsert` → InsertOp
  - Drag above threshold → `commitInsert` → InsertOp
  - Drag below threshold → `pointInsert(start)` fallback
  - No `commitInsert` → drag handlers absent on Tool record
  - Tool declares `id: 'text'`, `keybinding: 'T'`, `cursor: 'text'`
- **`hitExistingGate` tests**: new file. Hit / miss / array-return behavior.
- **Integration**: existing `apps/swillustrator/src/App.tsx` exercises both paths in the browser.

## Migration

- Swillustrator: `commitInsert` (the click-point factory) renames to `pointInsert`; `commitInsertBounds` renames to `commitInsert` to match the gesture-hook adapter contract. Two-line change.
- No other in-repo consumer of `useTextTool`. No version-bump considerations (pre-release).

## Files touched

- Modify: `src/interactions/gestures/insert/insert.ts`
- Modify: `src/interactions/gestures/insert/insert.test.ts`
- Rewrite: `src/tools/builtin/useTextTool.ts`
- Rewrite: `src/tools/builtin/useTextTool.test.ts`
- Modify: `src/tools/builtin/useInsertTool.ts` (small)
- Modify: `src/tools/builtin/useInsertTool.test.ts` (add gated cases)
- Add: `src/tools/builtin/hitExistingGate.ts`
- Add: `src/tools/builtin/hitExistingGate.test.ts`
- Modify: `apps/swillustrator/src/App.tsx`

## Risks

- The dispatcher routes plain clicks to `pointer.onClick` *only* when no drag handlers are registered. The text tool's "click-only mode" relies on this — when `commitInsert` is omitted, drag handlers must not be registered. Captured as a test assertion.
- `pointer.onClick` synthesizing a "zero-bounds drag" via `ctl.start; ctl.end` is fine because `useInsert`'s state is purely method-driven; no DOM events involved. Verified by existing dispatcher behavior (sub-threshold release calls `pointer.onClick` and doesn't touch `drag.*`).

## Out of scope (deferred to docs/TODO.md)

- Image / polygon / future drag-insert tools — the primitive is built so they're trivial to add, but each is its own task.
- Promoting `hitExistingGate` to also gate the move/resize paths on the select tool (different responsibility, different gesture).
