# Parallax layer primitive — design

Ship a `createParallaxLayer` RenderLayer factory and a `deriveParallaxView`
pure-math helper so consumers can compose multi-plane scenes where each plane
translates and/or scales at its own rate under the camera view.

This is the v1 cut: **cosmetic only**. Pointer events still target the outer
view; objects on parallax planes are paint, not clickable scene nodes. The
public `deriveParallaxView` helper exists specifically so the v2 interactive
follow-up has a stable seam to invert pointer positions through.

## Scope

**In v1:**

- `createParallaxLayer({ source, pan, zoom?, anchor? })` — RenderLayer factory.
- `deriveParallaxView(outer, opts) → View` — standalone pure helper.
- A `ParallaxDemo` showing 3+ planes panning at different rates.
- `space: 'screen'` semantics matching `createViewportLayer`.

**Deferred to follow-up specs:**

- **Interactive parallax** — dispatcher-aware hit-testing against the plane's
  derived view. Needs design work on which plane "owns" a click, fall-through
  semantics, and how `useSelectTool` learns about planes.
- **`useScene` integration** — a `parallax` property on user-layers that wires
  to `createParallaxLayer` at the `<SceneCanvas>` seam. Needs at least one real
  consumer to anchor the API shape.
- **Per-plane animation** — independent tween of a plane's `pan`/`zoom` for
  intro effects.

## Public surface

```ts
type ScalarOrXY = number | { x: number; y: number };

interface ParallaxOpts {
  pan: ScalarOrXY;
  zoom?: ScalarOrXY;        // default 1 (normal scaling)
  anchor?: { x: number; y: number }; // default { x: 0, y: 0 }
}

function deriveParallaxView(outer: View, opts: ParallaxOpts): View;

interface CreateParallaxLayerOpts<TData> extends ParallaxOpts {
  id: string;
  label: string;
  source: RenderLayer<TData>[];
}

function createParallaxLayer<TData>(
  opts: CreateParallaxLayerOpts<TData>,
): RenderLayer<TData>;
```

`pan`, `zoom` accept either a scalar (uniform x/y) or `{ x, y }` (per-axis).
A scalar widens to `{ x: s, y: s }` internally.

## Math

Canonicalize inputs:

```ts
const p = typeof pan  === 'number' ? { x: pan,  y: pan  } : pan;
const z = typeof zoom === 'number' ? { x: zoom, y: zoom } : (zoom ?? { x: 1, y: 1 });
const a = anchor ?? { x: 0, y: 0 };
```

Derive the inner view:

```ts
inner.x       = a.x + (outer.x       - a.x) * p.x;
inner.y       = a.y + (outer.y       - a.y) * p.y;
inner.scale.x = 1   + (outer.scale.x - 1)   * z.x;
inner.scale.y = 1   + (outer.scale.y - 1)   * z.y;
```

### Properties

- **Identity:** `pan = 1`, `zoom = 1`, any anchor → `inner = outer`. A
  `createParallaxLayer({ pan: 1 })` is observably identical to the unwrapped
  layer.
- **Pan locked:** `pan = 0` → `inner.x/y = anchor.x/y`. Plane doesn't move when
  camera pans; sits anchored at `anchor`.
- **Zoom locked:** `zoom = 0` → `inner.scale = { 1, 1 }`. Plane stays at
  identity scale regardless of camera zoom.
- **Screen-locked HUD:** `pan = 0`, `zoom = 0`, `anchor = { 0, 0 }` →
  fully camera-independent layer. (Side effect; not the primary use case.)

### Anchor semantics

The anchor is "the world-coord point where all parallax planes agree." Pan the
camera 100 world-units away from the anchor; a plane with `pan = 0.5` lags 50
world-units behind. Without an anchor, distant layers drift away as you pan
and never return — the anchor pins behavior. Default `{ 0, 0 }` is correct
for "scene origin = focal point" compositions; consumers re-anchor to put the
vanishing point elsewhere.

### Zoom interpolation choice

Linear interp from identity (`1 + (s - 1) * z`) over multiplicative (`s^z`).
Reasoning: linear's endpoints are intuitive (`z = 0` → scale 1, `z = 1` →
scale s) and the user picks a single number. Multiplicative is arguably more
physically correct (preserves zoom ratios under composition) but harder to
dial in. Consumers who want the multiplicative form can compose
`deriveParallaxView` themselves.

## Implementation shape

```ts
export function createParallaxLayer<TData>(
  opts: CreateParallaxLayerOpts<TData>,
): RenderLayer<TData> {
  const { id, label, source, pan, zoom, anchor } = opts;
  return {
    id,
    label,
    space: 'screen',
    draw: (data, outer, dims) => {
      const inner = deriveParallaxView(outer, { pan, zoom, anchor });
      return source.flatMap((layer) => layer.draw(data, inner, dims));
    },
  };
}
```

The wrapper is `space: 'screen'` for the same reason `createViewportLayer` is:
the source layers produce draw commands already projected under the inner view
(their own internal `viewToMat3` runs against the derived view). The outer
Canvas treats the wrapper's output as final and applies no additional
transform on top. Returning `space: 'world'` would double-project.

No `GroupDrawCommand` wrapping is needed — unlike `createViewportLayer`,
parallax doesn't clip and doesn't translate to a screen-space rect. Source
draw commands flow through directly.

## File layout

```
src/features/parallax/
├── index.ts                  # public barrel
├── deriveParallaxView.ts     # pure math helper
├── deriveParallaxView.test.ts
├── createParallaxLayer.ts    # RenderLayer factory
└── createParallaxLayer.test.ts
```

Matches the feature-roles taxonomy (`src/features/<name>/` with `index.ts`
barrel; the main `src/index.ts` re-exports through the feature barrel).
Mirror of the `src/features/viewports/` layout.

## Composition with `createViewportLayer`

Parallax and viewport are **sibling primitives**, not one wrapping the other.
Both derive an inner view, but viewport additionally clips to a screen-space
bounds rect and emits a `GroupDrawCommand` with a translation transform.
Parallax just substitutes the camera. Keeping them separate avoids dragging
clipping semantics into the parallax wrapper or stripping them out of
viewport.

Out of scope for this spec but worth noting: `createViewportLayer`'s
`view: View` argument has a long-standing comment flagging a future
`View | ((outer, dims) => View)` form. That promotion is a separate change;
parallax doesn't need it.

## Limitations (inherited from RenderLayer semantics)

Screen-space source layers (`space: 'screen'`) inside a parallax plane don't
compose meaningfully — they ignore the derived view by definition (that's
what `space: 'screen'` means). Document this; in practice nobody puts debug
overlays or selection chrome on a parallax plane. Same constraint as
`createViewportLayer`.

## Demo

`demo/demos/ParallaxDemo.tsx` (`#parallax`). Drag-pan with the hand tool over
a scene composed of:

1. **Sky** (`pan: 0.1`) — almost screen-locked clouds.
2. **Far hills** (`pan: 0.4`) — slow background.
3. **Ground** (`pan: 1.0`) — normal world layer (no parallax wrapper, for
   comparison).
4. **Foreground grass** (`pan: 1.3`) — leads the camera.

Each plane renders 5–10 colored shapes via inline `RenderLayer.draw`
functions; no scene adapter, no `useScene`. Demo's purpose is to show the
*motion* relationship, not to be a full app.

A second demo card or section toggles `zoom` factors so the per-plane zoom
behavior is visible.

## Tests

**Unit (`deriveParallaxView.test.ts`):**

- Identity property (`pan = 1, zoom = 1` → `inner = outer`).
- Pan-locked case (`pan = 0` → `inner.x = anchor.x`).
- Zoom-locked case (`zoom = 0` → `inner.scale = {1, 1}`).
- Scalar vs `{x, y}` parity (`pan: 0.5` ≡ `pan: { x: 0.5, y: 0.5 }`).
- Anchor effect (non-origin anchor shifts the fixed point as expected).
- Per-axis split (`pan: { x: 0.5, y: 1 }` lags x but not y).

**Integration (`createParallaxLayer.test.ts`):**

- Wrapping a synthetic RenderLayer with `pan: 0.5` and changing `outer.x`
  produces draw commands corresponding to an inner view at half the pan
  delta.
- `space === 'screen'`.
- Source layers receive the derived view (spy on `draw` arg).
- Empty `source: []` returns `[]` cleanly.

**Visual regression:** add `tests/visual/parallax.spec.ts` against the demo
URL once baselines can be captured via the CI soak workflow (per
CONTRIBUTING.md "Updating baselines"). Treat baseline capture as part of the
demo's PR, not a separate task.

## Public exports

Through `src/index.ts`:

- `createParallaxLayer`
- `deriveParallaxView`
- `CreateParallaxLayerOpts`
- `ParallaxOpts`

Grouped under a new `// ─── Parallax ───` section header in the barrel,
mirroring the existing section-header convention.

## Follow-ups (TODO.md entries to be promoted)

- **Interactive parallax (v2).** Dispatcher learns about parallax planes;
  pointer events invert through each plane's `deriveParallaxView` for
  hit-testing; click resolution walks planes in painter's order. Open: how
  planes are registered (declarative on `<Canvas layers>`, or via a separate
  registry); how `useSelectTool` learns the active plane; selection chrome
  rendering relative to the plane's view.
- **`useScene` user-layer `parallax` property.** `scene.addLayer({ id,
  parallax: { pan, zoom?, anchor? } })`. The `<SceneCanvas>` adapter wraps
  the scene-layer's render output in `createParallaxLayer` automatically.
  Requires `useScene` consumer demand.
- **Animated parallax.** Tween a plane's `pan`/`zoom` for intro effects, or
  parallax that responds to a non-camera signal (mouse position for hover
  parallax, scroll position for scroll-driven). Compose `useAnimator` over the
  parallax opts.
