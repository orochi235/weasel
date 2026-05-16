# Per-axis Zoom — Design

**Date:** 2026-05-16
**Status:** Approved (pending user spec review)
**Replaces:** TODO entry "Per-axis zoom (`scaleX` ≠ `scaleY`)" (originally deferred from `docs/specs/2026-05-07-viewport-followups-design.md`)

## Purpose

`View.scale` is currently a single number — pixels per world unit, uniform on both axes. This blocks any consumer that wants to zoom x and y independently: timeline charts (x is time, y is value), spectrograms, waterfall plots, hex-grid maps with non-square cells, any layout where the natural unit on each axis is different.

The change is intentionally a clean break of the viewport data shape. State always carries two scales; input APIs accept either a scalar (treated as uniform) or a per-axis vector. Built-in zoom tools gain an `axis` option so consumers can register an x-only or y-only wheel/keyboard zoom without writing a tool from scratch.

## Non-goals (v1)

- **Axis-aware elliptical hit shapes.** ~50 call sites currently divide a screen-px radius by `view.scale` to get a world-space scalar, then Euclidean-compare. Under non-uniform scale these would need to become ellipse comparisons (or transform hit-tests into screen space). v1 uses a geometric-mean fallback (see § "Chrome / hit-test scaling"). Proper axis-aware shapes are a future spec.
- **Modifier-key bindings for per-axis input.** No `shift+wheel = x-only` policy in the kit. The `axis` option exists; the consumer wires modifier-key mapping in their own tool wrapper if they want one. Every app draws the modifier line differently (Figma: shift+wheel = horizontal pan; charting libs: shift+wheel = zoom-x; Illustrator: no binding) — picking one would saddle every consumer with the wrong default.
- **Per-axis input on `usePinchZoomTool`.** Pinch hardware reports a single scale factor; no per-axis affordance is possible.
- **Backward-compatibility alias** for `view.scale` as `number`. Pre-1.0 license; clean break.
- **`useZoom` (deprecated)** — left untouched. It's already slated for removal and has no consumers.

## Type changes

```ts
// src/core/viewport/view.ts
export interface View {
  x: number;
  y: number;
  scale: { x: number; y: number };  // was: scale: number
}

// src/core/viewport/viewTransform.ts
export interface ViewTransform {
  panX: number;
  panY: number;
  zoom: { x: number; y: number };   // was: zoom: number
}

// New, exported from core/viewport (and the kit barrel)
export type ZoomFactor = number | { x: number; y: number };
export type ZoomBound  = number | { x: number; y: number };
```

State is always a vector. `ZoomFactor` and `ZoomBound` are *input* convenience — never used as storage. A scalar input means "same on both axes."

## Primitive surface

### `zoomAt`

```ts
function zoomAt(
  view: View,
  anchor: { x: number; y: number },
  factor: ZoomFactor,
  opts?: { min?: ZoomBound; max?: ZoomBound },
): View
```

Behavior:
- `factor: number` — multiplies both `scale.x` and `scale.y`.
- `factor: { x, y }` — multiplies each axis independently.
- `opts.min` / `opts.max` as `number` — same clamp applied to each axis.
- `opts.min` / `opts.max` as `{ x, y }` — different clamp per axis.
- Anchor-preservation guarantee holds per-axis: the world point under `anchor` stays under `anchor` after the call. Required derivation:

  ```
  worldX = anchor.x / view.scale.x + view.x
  worldY = anchor.y / view.scale.y + view.y
  // ...after zoom...
  next.x = worldX - anchor.x / nextScale.x
  next.y = worldY - anchor.y / nextScale.y
  ```

### `worldToScreen` / `screenToWorld`

```ts
function worldToScreen(wx, wy, t: ViewTransform): [number, number]
//   => [t.panX + wx * t.zoom.x, t.panY + wy * t.zoom.y]
function screenToWorld(sx, sy, t: ViewTransform): [number, number]
//   => [(sx - t.panX) / t.zoom.x, (sy - t.panY) / t.zoom.y]
```

### `viewToTransform`

Per-axis pass-through; translation sign-flip is per-axis:

```ts
function viewToTransform(view: View): ViewTransform {
  return {
    panX: -view.x * view.scale.x || 0,
    panY: -view.y * view.scale.y || 0,
    zoom: { x: view.scale.x, y: view.scale.y },
  };
}
```

### `fitViewToBounds`

```ts
function fitViewToBounds(
  bounds, viewportDims, currentView,
  opts?: FitViewToBoundsOptions & { mode?: 'contain' | 'fill' | 'stretch' },
): View
```

- `'contain'` (default — behavior-equivalent to today): uniform scale = `min(availW / bounds.width, availH / bounds.height)`. Bounds fit entirely; one axis has letterboxing.
- `'fill'`: uniform scale = `max(...)`. Bounds overflow viewport on one axis.
- `'stretch'`: per-axis scale = `{ x: availW / bounds.width, y: availH / bounds.height }`. Bounds match viewport exactly; scale is non-uniform.

Each axis of the resulting `scale` is clamped to `opts.minScale` / `opts.maxScale` independently.

### `clampView`

```ts
const visW = canvas.width / view.scale.x;
const visH = canvas.height / view.scale.y;
```

The visible-rect math is per-axis, but the clamp policy itself stays unchanged.

### `useViewTween`

Interpolate `scale.x` and `scale.y` independently:

```ts
const nextScale = {
  x: lerp(from.scale.x, to.scale.x, t),
  y: lerp(from.scale.y, to.scale.y, t),
};
```

### `renderer/math/viewToMat3`

The mat3 becomes diagonal-but-not-uniform:

```
[ scale.x,    0   , -view.x * scale.x ]
[    0   , scale.y, -view.y * scale.y ]
[    0   ,    0   ,         1         ]
```

## Tool layer

### `useWheelZoomTool` and `useKeyboardZoomTool`

Each gains an `axis` option:

```ts
useWheelZoomTool({ axis?: 'both' | 'x' | 'y' /* default 'both' */ })
useKeyboardZoomTool({ axis?: 'both' | 'x' | 'y' /* default 'both' */ })
```

When `axis === 'both'` (default): construct `factor` as a `number` and call `zoomAt(view, anchor, factor)`. Behavior is identical to today.

When `axis === 'x'`: construct `factor` as `{ x: f, y: 1 }`.
When `axis === 'y'`: construct `factor` as `{ x: 1, y: f }`.

No modifier-key wiring inside the tool. A consumer that wants `shift+wheel = x-only` registers two `useWheelZoomTool` instances (one `'both'`, one `'x'`) with different `when` predicates on the modifier, or wires a small wrapper tool — the kit doesn't take a position.

### `usePinchZoomTool`

Unchanged. Pinch reports a single scale factor; calls `zoomAt(view, anchor, scaleFactor)` where `scaleFactor` is a `number`.

## Chrome / hit-test scaling

Roughly 50 call sites today compute a world-space scalar from a screen-pixel value via `pxRadius / view.scale`. Under non-uniform scale a single world-space scalar can't represent a circular screen-pixel hit region — it's an ellipse. Two options for v1:

1. **Geometric mean fallback (chosen).** Add a helper `meanScale(s: { x; y }) = Math.sqrt(s.x * s.y)`. Existing `pxRadius / view.scale` sites become `pxRadius / meanScale(view.scale)`. Degenerates to `pxRadius / view.scale` when uniform. When non-uniform, the resulting world radius is slightly too large along the more-zoomed axis and slightly too small along the less-zoomed axis.
2. **Axis-aware ellipse hit-tests.** Every hit-test site is rewritten to compare against an ellipse (or to transform the hit-test into screen space). Correct but invasive — ~50 sites, three regime tests each, plus grid hairlines and snap-guide trigger zones have no obvious axis-aware analog.

v1 ships #1. The known limitation is documented at the kit level: at non-uniform zoom, hit affordances will look correct (rendered at their actual screen-px size by the chrome layer) but their pickable region will be a fraction too large / too small per-axis. Real consumers tolerate this for the timeline-chart case (anchor handles are visually accurate; the "off by 10%" hit region is invisible).

Same treatment for stroke widths set to "1 screen pixel" in chrome layers:

```ts
ctx.lineWidth = 1 / meanScale(view.scale);  // was: 1 / view.scale
```

`meanScale` lives in `core/viewport/view.ts` next to `viewToTransform` and is exported from the kit barrel for consumers that need the same fallback.

## Migration

Clean break. The change touches:

- **Types**: `View.scale`, `ViewTransform.zoom`, two new exported types (`ZoomFactor`, `ZoomBound`).
- **Read sites for `view.scale` / `view.zoom`**: ~57 references across `src/`, all mechanical. Most become `view.scale.x` and `view.scale.y` per-axis where the math is genuinely axis-aware (e.g. `worldToScreen` per-coord), and `meanScale(view.scale)` where a single scalar was used (chrome hit-radius, hairline strokes, snap-guide trigger zones).
- **Write sites for `view.scale`**: ~10 sites in the viewport primitives that construct a new `View` — these produce the new `{ x, y }` shape directly.
- **Apps**: `apps/swillustrator/` and the demo harness. `apps/swillustrator/src/App.tsx` reads `view.scale` in a few places (zoom-display chip, view-reset logic). These become `view.scale.x` directly — swillustrator's zoom chip is a single-number affordance, so it picks the x axis as canonical. The chip stays accurate as long as swillustrator's own tools only emit uniform zoom (which they do; it doesn't register an `axis: 'x'`/`'y'` variant of `useWheelZoomTool`).
- **Tests**: existing tests stay; their fixtures update `{ scale: 1 }` → `{ scale: { x: 1, y: 1 } }`. Test helpers (`makeView`, `defaultView`) get the same treatment.

No backward-compat alias. No runtime polymorphism on `View.scale` — always a vector. The kit lands the change in one PR; consumers update their fixtures in the same diff.

## Testing

New coverage:

- **`zoomAt`**: anchor-preservation per-axis with `factor: { x, y }`; per-axis clamping with `opts.min: { x, y }`; combined per-axis factor and per-axis clamp.
- **`fitViewToBounds`**: `'fill'` mode (verify max-of-axes scale, overflow direction); `'stretch'` mode (verify per-axis fit, exact viewport match); `'contain'` mode (existing tests stay, fixtures updated).
- **`useViewTween`**: tween from `scale: { x: 1, y: 1 }` to `scale: { x: 4, y: 2 }`; assert midpoint is `{ x: 2.5, y: 1.5 }`.
- **`clampView`**: visible-rect computed per-axis under non-uniform scale.
- **`viewTransform`**: per-axis `worldToScreen` / `screenToWorld` round-trip with `zoom: { x: 2, y: 3 }`.
- **`viewToTransform`**: per-axis pass-through with sign-flipped per-axis translation.
- **`viewToMat3`**: per-axis diagonal entries.
- **`useWheelZoomTool` `axis` option**: assert that `axis: 'x'` calls `setView` with a per-axis scale change on x only; `axis: 'y'` symmetric; `axis: 'both'` matches today.
- **`useKeyboardZoomTool` `axis` option**: same.
- **`meanScale`**: degenerate case (uniform → returns the scale); non-uniform case (returns `sqrt(x*y)`).

Existing test fixtures (every `{ scale: 1 }` in `*.test.ts`) get the mechanical update to `{ scale: { x: 1, y: 1 } }`. Where a uniform-scale assertion is genuinely uniform-only, the test stays; where it's actually axis-implicit (e.g. anchor-preservation), promote to per-axis.

## Demo

`demo/demos/PerAxisZoomDemo.tsx` at slug `#per-axis-zoom`. Layout:

- A `<SceneCanvas>` containing a single image (or a known-grid scene — e.g. a 10×10 world-unit grid with axis labels for visual feedback on which way x and y are scaling).
- Two sliders in the chrome: `scale.x` and `scale.y`, each 0.25 → 4 on a log scale, each updating `view.scale.{x,y}` independently via `setView`.
- A radio group: `fitViewToBounds` mode (`'contain'` / `'fill'` / `'stretch'`) + a "Fit to image bounds" button that calls `fitViewToBounds(imageBounds, viewportDims, view, { mode })`.
- A `useWheelZoomTool` ambient instance with `axis: 'both'` (default), so wheel still feels normal; a comment notes that switching to `axis: 'x'` would make wheel zoom horizontal-only.

Primarily a sanity surface for the breaking change — the slug shows up in the demo index next to the existing viewport demos.

## Surface impact summary

| Area                       | Change                                                          |
|----------------------------|-----------------------------------------------------------------|
| `View`                     | `scale: number` → `scale: { x: number; y: number }`             |
| `ViewTransform`            | `zoom: number` → `zoom: { x: number; y: number }`               |
| `ZoomFactor` (new)         | `number \| { x: number; y: number }`                            |
| `ZoomBound` (new)          | `number \| { x: number; y: number }`                            |
| `meanScale` (new)          | `(s: { x; y }) => sqrt(x * y)`                                  |
| `zoomAt`                   | `factor: ZoomFactor`, `opts.min/max: ZoomBound`                 |
| `fitViewToBounds`          | new `mode: 'contain' \| 'fill' \| 'stretch'`                    |
| `useWheelZoomTool`         | new `axis: 'both' \| 'x' \| 'y'`                                |
| `useKeyboardZoomTool`      | new `axis: 'both' \| 'x' \| 'y'`                                |
| `worldToScreen`/`screenToWorld` | per-axis multiply / divide                                 |
| `viewToMat3`               | per-axis diagonal entries                                       |
| `clampView`, `useViewTween`, `useViewAnimation` | per-axis internally                        |
| Chrome hit-test scaling    | `pxRadius / view.scale` → `pxRadius / meanScale(view.scale)`    |
| `useZoom` (deprecated)     | unchanged                                                       |

## Out of scope (explicit deferrals)

- **Axis-aware elliptical hit shapes.** Geometric-mean approximation ships in v1.
- **Modifier-key per-axis bindings on built-in tools.** Kit ships `axis` option; modifier mapping is the consumer's tool wrapper.
- **Per-axis pinch.** Hardware limitation.
- **Per-axis fit-to-bounds modes beyond contain/fill/stretch.** No `'cover'` (which would crop the bounds) — out of scope.
- **`useZoom` reshape.** Already deprecated; not touched.
