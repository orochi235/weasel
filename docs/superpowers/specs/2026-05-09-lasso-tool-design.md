# Lasso Tool Design

**Status:** approved 2026-05-09 (informal back-and-forth in chat)
**Tag:** `@experimental` in the public barrel

## Problem

The kit ships rectangular marquee selection via `useAreaSelect` + `selectFromMarquee` + `useSelectTool`'s area-select integration. There's no free-form polygon (lasso) selection — a feature listed as out-of-scope in `docs/specs/2026-05-01-canvas-kit-area-select-clipboard-design.md:275` and as an open follow-up in `docs/TODO.md` ("Lasso (non-rectangular) area-select"). Real consumers (illustration apps, diagramming tools) routinely want it for irregular selections that the AABB marquee can't express.

## Goal

Ship a sibling lasso primitive that:

1. Lives next to the marquee in `src/interactions/gestures/` and `src/tools/builtin/` — same shape, same behaviors plug-point.
2. Captures a polygon path during a single drag-to-paint gesture.
3. Selects objects via a configurable hit mode (`centers` / `intersect` / `enclosed`).
4. Pushes hit-testing through an opt-in adapter method (`hitTestLasso`) so spatial-index consumers can short-circuit; ships a naive `arrayAdapter` default for the common case.
5. Coexists with `useSelectTool` rather than replacing it — consumers opt in by registering `useLassoTool` in their tool palette.
6. Tags as `@experimental` — API may evolve before v2.

## Non-goals

- Inverse lasso (alt-held to select everything *outside* the polygon). Defer.
- Polygonal lasso (click-to-add-vertices, click-on-start to close) as a *bundled* primitive in this spec. Almost certainly buildable as a follow-up by composing `useLassoSelect`'s polygon→hits commit path with the pen tool's vertex-construction gesture. Track as a separate spec once both primitives have settled.
- Magnetic lasso (Photoshop-style edge snapping). Wants raster edge detection; not relevant to a vector scene graph.
- Per-vertex rubber-band preview. Distance-throttled sampling is fluid enough.
- Spatial-index integration. `hitTestLasso` is the seam; consumers with a quadtree/R-tree implement it. Kit ships only the naive `arrayAdapter` impl.
- Overlap with `useSelectTool` body/handle pickers. Lasso is its own Tool; selection-by-click and move/resize stay where they are.
- Replacing the marquee. Both primitives live side by side.

## Architecture

### §A — User-entry choice

Discrete `useLassoTool` Tool, sibling to existing built-ins (`useSelectTool`, `useHandTool`, `useUserPenTool`, etc.). Consumer wires it into `useTools({ registry: { lasso, ... } })` and the dispatcher activates it via its declared `keybinding: 'L'` (configurable via the Tool's keybinding override path; consumer can swap to `Shift+L` to match Figma without forking the tool).

Rationale: lasso is genuinely a different gesture from the marquee (free-form polygon vs AABB), and the kit's pattern is one Tool per gesture. Modifier-on-marquee or shape-switch-on-`useAreaSelect` would muddy semantics that aren't really shared.

### §B — Module layout

```
src/interactions/actions/lasso-select/
  lassoSelect.ts            // useLassoSelect — gesture hook (parallel to useAreaSelect)
  lassoSelect.test.ts
  index.ts                  // barrel
  behaviors/
    selectFromLasso.ts      // default behavior: replace/extend semantics
    selectFromLasso.test.ts

src/tools/builtin/
  useLassoTool.ts           // Tool wrapper (declares keybinding, owns overlay layer)
  useLassoTool.test.tsx

src/core/adapters/
  types.ts                  // add LassoSelectAdapter (extends AreaSelectAdapter)
  arrayAdapter.ts           // ship default hitTestLasso impl
```

Public surface (additive — no breaking changes):

```ts
export {
  useLassoSelect,
  type LassoSelectController,
  type UseLassoSelectOptions,
} from './interactions/actions/lasso-select';

export { selectFromLasso } from './interactions/actions/lasso-select/behaviors/selectFromLasso';

export { useLassoTool, type UseLassoToolOptions } from './tools/builtin/useLassoTool';

export type { LassoSelectAdapter } from './core/adapters/types';
```

### §C — Adapter contract

```ts
export type LassoHitMode = 'centers' | 'intersect' | 'enclosed';

export interface LassoSelectAdapter extends AreaSelectAdapter {
  /** Hit-test against a closed polygon (vertex order CW or CCW; the closing
   *  edge from last → first is implicit).
   *
   *  Modes:
   *    - 'centers'   — select objects whose bounds center falls inside the polygon.
   *    - 'intersect' — select objects whose bounds intersect the polygon (any overlap).
   *    - 'enclosed'  — select objects whose bounds are fully inside the polygon.
   *
   *  Returns the ids of hits (order unspecified). When omitted, `useLassoTool`
   *  skips wiring the default `selectFromLasso` behavior — same opt-in pattern
   *  as `hitTestArea`.
   */
  hitTestLasso?(
    polygon: readonly { x: number; y: number }[],
    mode: LassoHitMode,
  ): string[];
}
```

The `arrayAdapter` ships a default `hitTestLasso` that:
1. Computes the polygon AABB.
2. Filters objects whose AABB rejects against the polygon AABB (cheap prune).
3. For each survivor, applies the per-mode test:
    - `centers` — `pointInPath(polygon, cx, cy)` against the bounds center.
    - `enclosed` — `pointInPath(polygon, ...)` against all four bounds corners; all four must be inside.
    - `intersect` — corner-inside test first; if all out, polygon-edge-vs-bounds-edge crossing test (separating-axis or 4 segment-segment intersections per polygon edge).

`pointInPath` already uses even-odd fill, which gives self-crossing lassos the natural Photoshop "holes" behavior at no extra cost.

### §D — Gesture mechanics

**`useLassoSelect` hook surface** (mirrors `useAreaSelect`):

```ts
export interface UseLassoSelectOptions {
  behaviors?: LassoSelectBehavior[];
  /** When set, overrides any behavior's `defaultTransient`. */
  transient?: boolean;
  label?: string;                                  // default 'Lasso select'
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Skip vertices closer than this many world-px to the previous one.
   *  Default 2. Set 0 to record every pointermove sample. */
  minVertexSpacing?: number;
  debug?: DebugSink;
}

export interface LassoSelectController {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  isLassoSelecting: boolean;
  overlay: LassoSelectOverlay | null;       // { vertices, shiftHeld } during drag
  adapter: LassoSelectAdapter;
}
```

**Sampling.** Each `move()` call appends a vertex if its distance from the previous vertex is `≥ minVertexSpacing` world-px. Distance test uses squared distance to skip the sqrt.

**Closing.** Polygon closes implicitly at `end()` — the polygon passed to `hitTestLasso` is the recorded vertex array; the closing edge `last → first` is implicit per the contract. The overlay's dashed close-line is purely visual.

**Empty / tiny lasso fallthrough.** A lasso is treated as a click (i.e., empty rectangle today's marquee handles) when:
- `< 3` distinct vertices recorded, OR
- polygon AABB area `< 4 world-px²`.

In the click case, the default behavior clears the selection (or extends with shift held), matching `selectFromMarquee`'s empty-rect handling.

**Cancel.** Esc during gesture invokes `controller.cancel()`. Mirrors `useAreaSelect.cancel`. No ops emitted; overlay clears.

**Self-intersection.** Polygon containment uses even-odd fill (inherited from `pointInPath`). Self-crossing strokes naturally produce holes. v1 documents but does not special-case this.

### §E — Default behavior: `selectFromLasso`

Mirrors `selectFromMarquee`'s shape and contract. Pseudocode:

```ts
export interface SelectFromLassoOptions {
  /** Hit mode for `hitTestLasso`. Default 'intersect'. */
  mode?: LassoHitMode;
}

export function selectFromLasso(opts?: SelectFromLassoOptions): LassoSelectBehavior {
  const mode = opts?.mode ?? 'intersect';
  return {
    defaultTransient: true,
    onEnd(ctx) {
      const adapter = ctx.adapter as unknown as LassoSelectAdapter;
      if (!adapter.getSelection || !adapter.hitTestLasso) return null;

      const vertices = ctx.scratch.vertices;        // shaped by useLassoSelect
      const shiftHeld = ctx.origin.get('gesture')!.shiftHeld;

      // Tiny / degenerate lassos behave like click — clear, or extend on shift.
      if (vertices.length < 3 || polygonAabbArea(vertices) < 4) {
        const from = adapter.getSelection();
        const to = shiftHeld ? from : [];
        return [createSetSelectionOp({ from, to })];
      }

      const hits = adapter.hitTestLasso(vertices, mode);
      const from = adapter.getSelection();
      const to = shiftHeld
        ? unique([...from, ...hits])
        : hits;
      return [createSetSelectionOp({ from, to })];
    },
  };
}
```

Mode is configurable per-behavior-instance — consumers can register two `useLassoTool`s with different modes (e.g. `Q` for centers-mode lasso, `Shift+Q` for intersect) if they want.

### §F — Tool layer: `useLassoTool`

```ts
export interface UseLassoToolOptions extends Pick<UseLassoSelectOptions,
  'behaviors' | 'transient' | 'label' | 'onGestureStart' | 'onGestureEnd' |
  'minVertexSpacing' | 'debug'> {
  /** Hit mode forwarded to the default `selectFromLasso` behavior when no
   *  explicit `behaviors` array is passed. Default 'intersect'. */
  mode?: LassoHitMode;
  /** Override the default keybinding ('L'). Pass `null` to omit. */
  keybinding?: string | null;
}

export function useLassoTool(
  adapter: LassoSelectAdapter,
  options: UseLassoToolOptions = {},
): Tool<undefined> {
  // 1. Internally instantiate useLassoSelect with default behaviors=[selectFromLasso({ mode })] when none passed.
  // 2. Render the live polyline + dashed close-line in an overlay RenderLayer.
  // 3. Declare keybinding: options.keybinding ?? 'L'.
  // 4. On pointerDown over empty space: claim → controller.start.
  //    On pointerDown over a hit object: pass (let useSelectTool / move handle it).
  //    On pointerMove (claimed): controller.move.
  //    On pointerUp (claimed): controller.end.
  //    On Escape (claimed): controller.cancel.
}
```

The "empty space" check uses the adapter's existing `pickEvery` / `hitTest` plumbing — same pattern `useSelectTool` uses to distinguish body-hit vs miss.

### §G — Visual chrome

Overlay renders in screen-space (matching the existing marquee overlay's conventions):

| Element | Stroke | Color | Dash |
|---|---|---|---|
| Live polyline (vertices joined) | 1.5 screen-px | selection-overlay accent | solid |
| Cursor → start close-line | 1.5 screen-px | selection-overlay accent, alpha 0.5 | `[4, 3]` screen-px |
| Polygon fill | — | (none during gesture) | — |

No fill while the gesture is live: ghost-fill reads as "you just drew a shape" — wrong affordance for a selection tool. After commit, the overlay clears; selection-overlay handles the resulting selected-objects chrome.

## Testing

Files and the discriminating cases each test:

- `lassoSelect.test.ts`
  - lifecycle: start / move / end / cancel state transitions
  - sampling throttle: `minVertexSpacing` skips near-duplicates; setting `0` records every sample
  - vertex array exposed via overlay during gesture
  - `cancel()` produces no ops, no behavior `onEnd` invocation
  - Esc during gesture invokes cancel (when wired through Tool)
  - modifier passthrough (shift held at start preserved through end)

- `selectFromLasso.test.ts`
  - tiny/empty polygon falls through to click-like clear (or extend with shift)
  - mode plumbing: `centers` / `intersect` / `enclosed` each forward correctly to `hitTestLasso`
  - shift-extend merges hits with current selection (no duplicates)
  - non-shift replace semantics
  - `null` return when `hitTestLasso`/`getSelection` missing on adapter

- `useLassoTool.test.tsx`
  - keybinding `L` activates the tool through `useTools` dispatcher
  - empty-space pointerDown claims; object-hit pointerDown passes
  - overlay layer is published (live polyline visible during drag)
  - integrates with `arrayAdapter` end-to-end (commit → selection updates)

- `arrayAdapter` extension (in `arrayAdapter.test.ts`)
  - `centers` mode: square scene, polygon over 1 of 4 squares
  - `intersect` mode: polygon edge cuts through a square's bounds
  - `enclosed` mode: polygon contains 2 squares fully, partial square excluded
  - self-crossing polygon: figure-8 produces "hole" behavior matching even-odd
  - degenerate polygon (`< 3` vertices): empty result

## Code-shape constraints

- **Kit-owned scene state:** none — lasso doesn't introduce scene objects.
- **Op-emitting:** `selectFromLasso` returns `[SetSelectionOp]`. No new op kinds.
- **Adapter additions:** `hitTestLasso` (optional, on `LassoSelectAdapter` extending `AreaSelectAdapter`).
- **No public API breakage** vs current kit surface.
- **Bundle impact:** new lasso module ~250 LOC + tests; `arrayAdapter` gains the polygon hit-test (~80 LOC). Total ≤ ~400 LOC product code.
- **Tree-shakeable:** consumers who don't import `useLassoTool` / `useLassoSelect` pay nothing.

## Out of scope (deferred)

- **Inverse lasso.** Add `mode: 'outside'` once a real consumer wants it.
- **Polygonal-lasso click-mode** as a separate Tool composed from this lasso's commit path + the pen tool's vertex-construction gesture. The pieces will exist after this ships; bundling them into a `useUserPolyLassoTool` (or similar) is its own spec, partly to validate that the lasso/pen primitive surfaces are well-shaped for composition.
- **Magnetic lasso.** Raster-only feature; not aligned with the kit.
- **Animated lasso "marching ants" stroke.** Pure visual polish; defer.
- **Selection-overlay integration for partial-hit feedback** (e.g. highlight candidates as the cursor moves). Adds gesture-time `hitTestLasso` calls — measure cost first.
- **Multi-region lasso (Shift while dragging mid-gesture splits into a second polygon).** Significant state-machine complexity; no clear consumer pull.
