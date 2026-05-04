# Container layout strategies design

**Date:** 2026-05-03
**Status:** Spec — ready for plan
**TODO entry it resolves:** "Container layout strategies" under Tier 1.5 in `docs/TODO.md`.
**Driving consumer:** eric (`~/src/eric`) — raised beds and planters as weasel containers; plants drag in/out and reflow.

## Problem

Containers (groups with `getChildren` / `setChildOrder`) are first-class in weasel, but children are positioned by absolute pose. There's no notion of a *layout owned by the container* that knows how children should be arranged or what happens when one is dragged in or out. Real apps (eric being the immediate one) want stack/grid/freeform/snap-point semantics: dragging a child between containers should reflow siblings; dropping into a grid should snap to a cell; some containers should reject incompatible drops.

## Goal

Ship a small, composable `LayoutStrategy<TPose>` interface plus three reference strategies that cover the common cases: freeform (no constraint), tile-grid (N×M cells), snap-point (generated points). Layouts compose with a separate `LayoutSnap<TPose>` axis so the same layout can be paired with different snap policies (e.g. grid + nearest-within-tolerance). Cross-container drag is first-class; source and destination both reflow live during the drag preview.

App-specific patterns (eric's slot-based arrangements, quadtree packing, plant-radius rules) stay in the consumer or get rewritten as custom container objects on top of this primitive. The kit's job is the contract + the generic strategies; the domain is the consumer's job.

## Architecture

### Core types

```ts
type ContainerBounds = { x: number; y: number; width: number; height: number };

interface LayoutChild<TPose> {
  id: string;
  pose: TPose;
}

interface DropTarget<TPose> {
  /** Where the dragged child lands if this target is picked. */
  pose: TPose;
  /** Reference point for distance metrics (snap algorithms). */
  origin: { x: number; y: number };
  /** Strategy-private metadata (e.g. cell coords for tile-grid). */
  meta?: unknown;
}

interface LayoutStrategy<TPose> {
  /** Authoritative positions for committed children. Used by the renderer
   *  and after structural changes (insert / delete / reparent). */
  getChildPositions(
    container: { id: string; bounds: ContainerBounds },
    children: ReadonlyArray<LayoutChild<TPose>>,
  ): Map<string, TPose>;

  /** Candidate drop positions the snap policy will choose from.
   *  May depend on the dragged child (e.g. size-aware grids skip cells too small). */
  getDropTargets(
    container: { id: string; bounds: ContainerBounds },
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: { id: string; pose: TPose; sourceContainerId: string | null },
  ): DropTarget<TPose>[];

  /** Sibling reflow given a chosen target (or null = no snap → free-space fallback).
   *  Returns ONLY siblings whose pose changes; unchanged children are omitted. */
  reflowFor(
    container: { id: string; bounds: ContainerBounds },
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: { id: string; pose: TPose; sourceContainerId: string | null },
    target: DropTarget<TPose> | null,
  ): Map<string, TPose>;

  /** Op batch to commit the drop. Includes setParent (if cross-container),
   *  the dragged child's setPose, and any sibling setPose ops the layout
   *  needs. Source-container reflow ops are produced separately by the
   *  gesture (which calls the source layout's getChildPositions on the
   *  reduced child set). */
  commitDrop(
    container: { id: string; bounds: ContainerBounds },
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: { id: string; pose: TPose; sourceContainerId: string | null },
    target: DropTarget<TPose> | null,
  ): Op[];

  /** The snap policy bundled with this layout. Each layout ships a sensible
   *  default; consumers can override via the layout's factory config. */
  snap: LayoutSnap<TPose>;
}

interface LayoutSnap<TPose> {
  pickTarget(
    targets: DropTarget<TPose>[],
    pointer: { x: number; y: number },
  ): DropTarget<TPose> | null;
}
```

### Reference layouts

Three factories, each returning a `LayoutStrategy<TPose>`. Each accepts an optional `snap` field overriding its default.

```ts
freeform<TPose>(opts?: { snap?: LayoutSnap<TPose> }): LayoutStrategy<TPose>;
// Default snap: none()

tileGrid<TPose>(opts: {
  cols: number;
  rows: number;
  gap?: number;
  snap?: LayoutSnap<TPose>;
}): LayoutStrategy<TPose>;
// Default snap: cellAt()

snapPoint<TPose>(opts: {
  pattern: 'corners' | 'edges' | 'center' | 'grid';
  gridSpacing?: number;
  tolerance?: number;
  snap?: LayoutSnap<TPose>;
}): LayoutStrategy<TPose>;
// Default snap: nearestWithin({ tolerance: opts.tolerance ?? Infinity })
```

Behavior:

| Layout | `getChildPositions` | `getDropTargets` | `reflowFor` | Commit ops |
|---|---|---|---|---|
| `freeform` | identity over stored poses | empty (snap is `none`, ghost follows pointer) | empty (no reflow) | `setPose(dragged)` (+ `setParent`) |
| `tileGrid` | assigns children to cells in id-stable order; overflow children skipped (deferral) | cell centers as `DropTarget` with `meta: { col, row }` | swap-on-occupied: returns `Map(occupant → dragged's previous slot)` | `setPose(dragged)` + swap `setPose` (+ `setParent`) |
| `snapPoint` | identity over stored poses | generated points per pattern | empty (snap-point doesn't reposition siblings) | `setPose(dragged → snapped point)` (+ `setParent`) |

### Built-in snap policies

```ts
none<TPose>(): LayoutSnap<TPose>;
// Always returns null. Consumer of the result treats null as "use raw pointer."

nearest<TPose>(): LayoutSnap<TPose>;
// Closest target by Euclidean distance to pointer. Never null unless targets is empty.

nearestWithin<TPose>(opts: { tolerance: number }): LayoutSnap<TPose>;
// Closest target within `tolerance` distance, else null.

cellAt<TPose>(): LayoutSnap<TPose>;
// Picks the target whose `meta` cell rect contains the pointer (tile-grid specific).
// Falls back to nearest if pointer is outside all cells.
```

### Adapter integration

The adapter gains one optional method:

```ts
interface ContainerAdapter {
  // ... existing fields (getChildren, getParent, setChildOrder, etc.)

  /** Returns the layout strategy attached to this container, or null if the
   *  container uses absolute positioning (current behavior). */
  getLayout?(containerId: string): LayoutStrategy<TPose> | null;
}
```

Containers without `getLayout` (or returning null) keep today's absolute-positioning semantics — full backward compatibility for every existing demo and consumer. Containers that opt in get layout-driven drag/drop.

The strategy is constructed once in the consumer's render closure (e.g. `useMemo(() => tileGrid({ cols: 4, rows: 4 }), [])`) and returned from `getLayout`. Strategies are not stored in scene state — they're closures over config, not serializable; the container node carries serializable `layoutConfig` (e.g. `{ kind: 'tile-grid', cols: 4 }`) and the consumer's `getLayout` resolves config → strategy.

### Move-gesture integration

`useMove` (and `useSelectTool` by transitive use) becomes layout-aware:

**Per pointer-move:**
1. Hit-test containers under pointer using existing `hitBody` machinery, walking parent chain. Take the top-most container as the candidate destination.
2. Read `adapter.getLayout(containerId)`. If null, fall through to next container up the chain. If no container claims, the gesture falls back to absolute-positioning (today's behavior — ghost follows pointer).
3. Call `strategy.getDropTargets(...)` then `strategy.snap.pickTarget(targets, pointer)`. If the result is `null`, treat as rejection: fall through to next container.
4. Call `strategy.reflowFor(container, children, dragged, target)` for destination siblings.
5. If the source is a layout-bearing container *and* differs from dest, also call `sourceStrategy.getChildPositions(sourceContainer, sourceChildren minus draggedId)` and diff against current poses to derive source-side reflow.
6. Publish a single `MoveOverlay`:
   ```ts
   {
     ghostPose: TPose,
     hypotheticalChildPositions: Map<id, TPose>,  // dest reflow
     sourceReflowPositions?: Map<id, TPose>,      // source reflow if cross-container
     destContainerId: string | null,              // for highlight chrome
     accepted: boolean,                           // false = no container accepted
   }
   ```

**On release (commit):**
1. If `accepted`, emit a batch combining: `strategy.commitDrop(...)` ops + (if cross-container) source reflow ops produced by walking source's children minus dragged and emitting `setPose` for any whose pose differs from current.
2. If `!accepted`, emit a single `setPose` for the dragged child to its free-space pointer position. (This rejection-handling shape is flagged for revisit — see Deferred.)

**Rendering:** the move tool's existing overlay channel (the `Tool.overlay` `RenderLayer` shipped in `2026-05-03-tool-overlay-channel-design.md`) reads the extended `MoveOverlay` and draws ghost + reflowed siblings. No new render seam.

### Composability example

```ts
// A 4×4 grid that only snaps when the pointer is within 1 world unit of a cell.
const layout = tileGrid({
  cols: 4,
  rows: 4,
  gap: 0.05,
  snap: nearestWithin({ tolerance: 1 }),
});

// A freeform container that visually overlays a snap grid for guidance.
const layout = freeform({
  snap: nearestWithin({ tolerance: 0.25 }),
});
// Combined with a custom getDropTargets via a wrapping factory if needed —
// or use snapPoint({ pattern: 'grid', gridSpacing: 1 }) for the same effect
// with reflow-free behavior.
```

## Files to create / modify

**Create:**

- `src/layout/types.ts` — `LayoutStrategy<TPose>`, `LayoutSnap<TPose>`, `LayoutChild<TPose>`, `DropTarget<TPose>`, `ContainerBounds`.
- `src/layout/snaps.ts` — `none`, `nearest`, `nearestWithin`, `cellAt`.
- `src/layout/strategies/freeform.ts`
- `src/layout/strategies/tileGrid.ts`
- `src/layout/strategies/snapPoint.ts`
- `src/layout/strategies/index.ts` — barrel.
- `src/layout/index.ts` — top-level barrel.
- `demo/demos/LayoutDemo.tsx` — three strategies side by side, cross-container drag.

**Modify:**

- `src/interactions/gestures/move/move.ts` — extend `MoveOverlay<TPose>` with `hypotheticalChildPositions`, `sourceReflowPositions`, `destContainerId`, `accepted`. Pointer-move calls `adapter.getLayout` on top-most container; commits batched ops including reflow.
- `src/interactions/gestures/move/types.ts` — add the new overlay fields.
- `src/canvas/Canvas.tsx` — pass layout-aware overlay through to the active Tool's overlay (no behavior change in absence of `getLayout`).
- `src/index.ts` — export layout module.
- Adapter contract docs (wherever `MoveAdapter` / nested-group adapter is documented) — note `getLayout` is optional and absence preserves current behavior.

**Tests:**

- `src/layout/strategies/freeform.test.ts` — `getChildPositions` returns identity; `getDropTargets` empty; `commitDrop` emits single `setPose`.
- `src/layout/strategies/tileGrid.test.ts` — cell math, swap-on-occupied, overflow skip behavior, default `cellAt` snap, override snap.
- `src/layout/strategies/snapPoint.test.ts` — pattern generation per pattern type, `nearestWithin` rejection.
- `src/layout/snaps.test.ts` — each snap policy in isolation against canned target arrays.
- `src/interactions/gestures/move/move.layout.test.ts` — gesture integration: drag inside a layout container, drag across two layouts, drag to free space, rejection fall-through, source reflow on cross-container exit, commit ops shape (batched, source + dest).
- Demo integration: `demo/demos/__tests__/layoutDemo.integration.test.tsx` — drives a cross-container drag and asserts the destination's children reflow.

## Tests required

(Covered above per file.) The interface lives under `src/layout/`, separate from `src/interactions/`, so the strategy tests run as pure-function unit tests with no React or Canvas dependencies. Move-gesture integration is the single integration point and gets dedicated coverage.

## Deferred / out of scope

Tracked in `docs/TODO.md`:

- **Drop rejection signal.** v1 commits a free-space `setPose` when no container accepts. Needs a cleaner semantic — candidates: a dedicated cancel op, a snap-back-to-source-pose path, or having the source layout's `commitDrop` re-place the child at its origin slot.
- **Tile-grid overflow policy.** Children beyond `cols * rows`: currently skipped from `getChildPositions`. Real apps may want scroll, grow-grid, or rejection — pick once a consumer asks.
- **Strategy-aware drop regions.** Today the move gesture hit-tests against container body bounds. A strategy could expose a `dropRegion(container) → Bounds` that extends beyond visible bounds for forgiveness (e.g. row layouts catching pointers slightly past the row's end).
- **Stateful strategy factories.** All v1 strategies are pure functions over their inputs; no caching. If profiling shows recompute pain (likely only quadtree-class), promote to a factory returning `(container) → { ... }` with cached state.
- **Animated reflow transitions.** Sibling reflow is snap-to-target in v1. Smooth interpolated movement during the preview is a layer above (likely a `useAnimatedReflow` hook) — not in v1.
- **Quadtree / packing strategies.** Eric's quadtree strategy stays in eric (or as a future plugin). Niche enough not to belong in the generic kit.
- **Slot-based strategy** (rows/grid/ring arrangements à la eric's `@/model/arrangement`). Worth lifting once the v1 three settle and a kit-generic shape emerges that doesn't drag domain types.
- **Configurable hit-test order.** v1 uses top-most container under pointer. Innermost-regardless-of-z and explicit-drop-region modes (options B and C from the brainstorm) are escape hatches if a real consumer needs them.
- **Per-strategy `acceptsDrop(dragged) → boolean`.** Today rejection is implicit (snap returns null). An explicit pre-check could short-circuit `getDropTargets` for incompatible objects (e.g. grid that only accepts squares). Add when type-aware containers appear.
- **Multi-select drag into a layout.** v1 layouts model a single dragged child. Multi-select drag falls back to absolute (or each child individually if the layout's `previewDrop`/`commitDrop` is called per id, but reflow semantics get hairy fast).

## Migration notes

- Zero breaking changes for existing consumers. `getLayout` is an optional adapter method; absent or null means absolute positioning, identical to today's behavior.
- Adopting layouts in an existing app is per-container: implement `getLayout(id)` on the adapter, return a strategy for the containers you want layout-driven, return null for the rest.
- Eric will be the first real consumer. Its raised-bed and planter containers each get a `tileGrid` or `snapPoint` strategy via `getLayout`; existing scene-graph machinery (nested containers, undo/redo, selection) all work unchanged.
