# Detached minimap (`<SceneViewCanvas>` + `<MinimapCanvas>`)

## Problem

Weasel already has a "minimap" pattern via `createViewportLayer`: an inset
rendered **inside** the main `<SceneCanvas>`'s drawing buffer, painted as a
clipped, transformed group on top of the regular scene layers. See
`demo/demos/ViewportLayerDemo.tsx` and `src/features/viewports/viewportLayer.ts`.
That superimposed approach is great when the minimap belongs inside the
canvas's pixel territory (HUD overlays, picture-in-picture, transient
peek-ahead lenses).

It's the wrong shape for the **detached** case: a minimap that lives in a
sidebar, a docked inspector panel, a floating window, a separate scrollable
region — anywhere outside the main canvas's bounding box. With
`createViewportLayer` the minimap can only exist where the main canvas is
already painting; you can't stick it in a flex sibling, position it absolutely
to a different DOM ancestor, or scroll it independently. Sizing it requires
expanding the main canvas. Layering it underneath other DOM is impossible
without ugly stacking-context gymnastics.

The detached pattern wants the minimap as a **separate DOM element with its
own GL context**, mounted wherever the consumer wants in their tree. Two
canvases, pointer-independent, each rendering the same scene through different
views.

This spec describes two new components to support that:

- **`<SceneViewCanvas>`** — generic, pointer-inert read-only render of a scene
  at a given view, into its own `<canvas>`. Thumbnails, side-by-side previews,
  printable snapshots, alternate-view inspectors. No tools, no selection
  chrome, no interactivity.
- **`<MinimapCanvas>`** — built on top of `<SceneViewCanvas>`. Adds a
  dashed visible-window indicator and hardcoded click-to-recenter /
  drag-to-pan against the main canvas's view. Mounts its own `<canvas>` and
  its own WebGL2 context.

The existing `createViewportLayer` stays. `<MinimapCanvas>` is **additive**,
not a replacement.

## Design decisions (the short version)

1. **Two components, layered.** `<SceneViewCanvas>` is the generic primitive;
   `<MinimapCanvas>` is the opinionated minimap built on top of it. Splitting
   yields a useful read-only-view primitive for free, and keeps the minimap's
   interaction code in one place where its assumptions (mainView + mainViewDims
   exist, click recenters main view) are explicit.

2. **Detached, not superimposed.** Each component mounts its own `<canvas>`
   DOM element. Two GL contexts in a typical setup (main + minimap). No FBO
   substrate, no `insets` prop on `<SceneCanvas>`, no shared-target trickery.
   Browser positioning, not pixel positioning.

3. **Custom `drawOne`, no default.** Both components require the consumer
   to supply a `drawOne(node, pose, view) => DrawCommand[]` prop. There is
   intentionally no "AABB-fill default" — a minimap drawOne is *typically* a
   simplified version of the main canvas's drawOne (just AABB rects in node
   color), but it's the consumer's call. Anything that auto-derived a draw
   function from the scene would have to make decisions (fill? stroke?
   simplify paths?) the kit can't make sensibly.

4. **Explicit `mainViewDims`.** `<MinimapCanvas>` needs the main canvas's
   pixel dims to compute the visible-window rect. The consumer passes
   `mainViewDims={{ width, height }}` explicitly — no ref-magic, no Context,
   no "find the main canvas via DOM query." The consumer already has those
   dims (they pass them to `<SceneCanvas>`).

5. **Click + drag interactions, no modifier.** v1 interactions on
   `<MinimapCanvas>`: click anywhere recenters the main view on that world
   point; drag anywhere pans the main view continuously while the pointer
   moves. No modifier-key variants, no "drag the indicator handle"
   distinction (the indicator is purely a render — it isn't a hit target).

6. **No gesture router / dispatcher.** `<MinimapCanvas>` attaches native
   pointer listeners (with `setPointerCapture`) to its own canvas. Hardcoded
   behavior. The two canvases are pointer-independent — the browser routes
   events to whichever element is under the pointer. The kit's gesture
   helpers (`thresholdDrag`, pointer capture wrappers) may be reused inside
   the component, but **there is no Tool / Action / Interaction binding**.
   This is a single one-off gesture pair (click, drag) with a fixed effect.
   See `docs/taxonomy.md`: gesture = how, action = what; we have a literal
   one-of-each here and don't need the abstraction.

7. **`<SceneViewCanvas>` is pointer-inert.** No event listeners. Consumer
   attaches their own if they want a clickable thumbnail or whatever.

8. **`fit` lives on `<MinimapCanvas>`, not `<SceneViewCanvas>`.**
   `<SceneViewCanvas>` takes an explicit `view` prop — it's a primitive,
   the caller decides what they're rendering. `<MinimapCanvas>` layers a
   `fit` policy on top that derives the view from a `fit="scene" |
   "world" | fn` prop.

9. **Shared scene, shared op log, no consumer coordination.** Because
   `<SceneCanvas>` and `<MinimapCanvas>` receive the same `scene` reference
   from one `useScene(...)` call, mutations through either side hit the
   same store and both re-render. Ops pushed from either canvas land in
   the same undo log. The consumer writes no synchronization glue —
   passing `scene` to both is the totality of the wiring. This property
   falls out of the existing scene primitive; the minimap doesn't add
   anything to enable it. v1 doesn't exercise it (the minimap mutates
   only `mainView`, never the scene); if a future use case wants
   scene-editing from a second viewport, the path is a second
   `<SceneCanvas>`, not growing `<MinimapCanvas>` into a tool-bearing
   widget.

## API sketch

### `<SceneViewCanvas>`

```tsx
import type { Scene } from '@weasel-js/core';
import type { View } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core';

interface SceneViewCanvasProps<TData, TLayer, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  view: View;
  width: number;                // CSS pixels
  height: number;               // CSS pixels
  drawOne: (node: Node<TData, TLayer, TPose>, pose: TPose, view: View) => DrawCommand[];
  className?: string;
  /** Optional: caller-supplied background fill before the scene paints.
   *  Avoids the "WebGL canvas is transparent and shows DOM through" gotcha.
   *  CSS class is preferred but the GL clear-color route is exposed because
   *  consumers sometimes want it to match a specific paper color exactly. */
  background?: string;
  /** Optional: expose the underlying <canvas> for consumers who want to
   *  snapshot it (`toBlob`), screenshot it for export, or attach their own
   *  pointer listeners. */
  canvasRef?: React.Ref<HTMLCanvasElement>;
}

export function SceneViewCanvas<TData, TLayer, TPose>(
  props: SceneViewCanvasProps<TData, TLayer, TPose>,
): JSX.Element;
```

**No inline styles.** `className` is the styling hook. Sizing is via the
`width` / `height` props (which set the GL drawing-buffer size and CSS size
together, matching how `<SceneCanvas>` already handles DPR). If the consumer
needs different CSS-size-vs-buffer-size behavior, they layer it on top.

**Subscriptions.** Subscribes to `scene` via `useSyncExternalStore` (same
hook the main canvas uses), so any scene mutation re-renders the view.
Beyond that, re-renders on every parent re-render — `view`, `drawOne`,
`width`, `height` are all React props, so React's normal reconciliation
handles invalidation. No internal RAF loop; render is on demand.

### `<MinimapCanvas>`

```tsx
import type { Scene, View, DrawCommand } from '@weasel-js/core';

interface MinimapCanvasProps<TData, TLayer, TPose> {
  /** Same scene the main canvas is rendering. */
  scene: Scene<TData, TLayer, TPose>;

  /** Main canvas's view + dims. Required for the visible-window indicator
   *  rect math. The consumer already has these — they pass them to
   *  <SceneCanvas>. */
  mainView: View;
  mainViewDims: { width: number; height: number };

  /** Setter for the main view. Called on click (recenter) and on drag
   *  (continuous pan). Should be the same setter the main canvas's
   *  `onViewChange` calls. */
  onMainViewChange: (next: View) => void;

  /** Minimap's own dims (CSS px). */
  width: number;
  height: number;

  /** Consumer's simplified drawOne, applied through the minimap's view. */
  drawOne: (node: Node<TData, TLayer, TPose>, pose: TPose, view: View) => DrawCommand[];

  /** How to compute the minimap's own view. */
  fit?:
    | 'scene'                                            // default: AABB union of all nodes
    | { kind: 'world'; rect: { x: number; y: number; width: number; height: number } }
    | ((scene: Scene<TData, TLayer, TPose>, dims: { width: number; height: number }) => View);

  /** Pose → AABB. Defaults to identity (`pose as Bounds`). The kit's
   *  `sceneAdapter` already uses this same default. */
  poseBounds?: (pose: TPose) => { x: number; y: number; width: number; height: number };

  /** Visual tuning. CSS-var tokens are preferred — these props are escape
   *  hatches for one-off overrides. */
  indicatorStroke?: string;       // default: a token, e.g. var(--minimap-indicator-stroke)
  indicatorDash?: number[];       // default: [2, 3]
  indicatorWidth?: number;        // default: 1
  background?: string;

  className?: string;
  canvasRef?: React.Ref<HTMLCanvasElement>;
}

export function MinimapCanvas<TData, TLayer, TPose>(
  props: MinimapCanvasProps<TData, TLayer, TPose>,
): JSX.Element;
```

**Why `mainView` + `mainViewDims` + `onMainViewChange` as three separate
props rather than a `controller` bag.** Each one has a different lifecycle:
`mainView` changes every frame during pan, `mainViewDims` changes only on
resize, `onMainViewChange` is stable. Keeping them flat avoids a
useless-render storm from a wrapper object identity changing every frame.

### Usage

```tsx
function MyEditor() {
  const scene = useScene<NodeData, LayerId, Pose>({ ... });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const MAIN_W = 800;
  const MAIN_H = 600;

  const drawOne = useCallback((n, p, v): DrawCommand[] => [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill: { fill: 'solid', color: n.data.color },
  }], []);

  return (
    <div className="my-editor">
      <aside className="my-editor__sidebar">
        <MinimapCanvas
          scene={scene}
          mainView={view}
          mainViewDims={{ width: MAIN_W, height: MAIN_H }}
          onMainViewChange={setView}
          width={200}
          height={140}
          drawOne={drawOne}
          fit="scene"
        />
      </aside>
      <main>
        <SceneCanvas
          width={MAIN_W}
          height={MAIN_H}
          scene={scene}
          view={view}
          onViewChange={setView}
          layers={{ scene: { drawOne } }}
        />
      </main>
    </div>
  );
}
```

The same `drawOne` is reused here for brevity; in real code the minimap's
drawOne is typically a stripped-down version (no strokes, no text, no
gradients — just colored AABBs).

## Behavior details

### Fit computation (`<MinimapCanvas>`)

Three modes:

- **`fit="scene"` (default).** Walk `scene.nodes`, union each node's AABB
  via `poseBounds`, derive a `View` that fits that rect into the minimap's
  `width × height` with a small inset margin (e.g., 8 CSS px on each side).
  Re-derives whenever the scene's revision (the `useSyncExternalStore`
  snapshot) changes, or when `width`/`height` change. Uniform scale on both
  axes; whichever axis is the tighter constraint wins, the other gets
  letterboxed. If the scene is empty, fall back to a sensible default
  (identity view centered on origin).
- **`fit={{ kind: 'world', rect }}`.** Fit a caller-specified world rect
  into the minimap. Useful when the consumer has a meaningful "page" or
  "canvas extent" that's separate from scene AABBs (e.g., WeaselDraw's
  document page).
- **`fit={fn}`.** Caller supplies `(scene, dims) => View` directly. Escape
  hatch for anything the two above don't cover (animated zoom-to-fit,
  custom margins, etc.).

**Pose AABB derivation.** Defaults to the same identity `pose as Bounds`
cast that `src/canvas/sceneAdapter.ts` (line 249) and
`src/tools/builtin/select/useSelectTool.ts` (line 138) use. Consumers with
non-rect poses pass `poseBounds={...}` — the same function they're already
threading through `sceneAdapter` / `useSelectTool`.

`boundsOfPath` (from `src/features/paths/bounds.ts`) is **not** used by the
minimap — it operates on `Path`, not `Pose`. If a consumer wants
path-accurate bounds (rather than pose AABBs) for the fit, they pass a
custom `poseBounds` that calls `boundsOfPath` on the node's stored path.
This keeps the kit-default cheap.

### Indicator rect math

The main canvas's visible window in world coords:

```
worldX = mainView.x
worldY = mainView.y
worldW = mainViewDims.width  / mainView.scale.x
worldH = mainViewDims.height / mainView.scale.y
```

The minimap renders a dashed stroke at that world rect, transformed through
the minimap's own view. As a `DrawCommand`:

```ts
{
  kind: 'path',
  path: {
    kind: 'rect',
    x: (worldX - minimapView.x) * minimapView.scale.x,
    y: (worldY - minimapView.y) * minimapView.scale.y,
    width:  worldW * minimapView.scale.x,
    height: worldH * minimapView.scale.y,
  },
  stroke: { paint: { fill: 'solid', color: indicatorStroke }, width: indicatorWidth, dash: indicatorDash },
}
```

This matches the math `ViewportLayerDemo` (`demo/demos/ViewportLayerDemo.tsx`
lines 86–100) already uses. The indicator is composited as an extra
post-scene draw step in the same render call as the scene nodes — not a
separate layer.

### Pointer handling

`<MinimapCanvas>` attaches `pointerdown`, `pointermove`, `pointerup`,
`pointercancel` to its own canvas. The handler:

1. **`pointerdown`**: `e.target.setPointerCapture(e.pointerId)`. Record the
   pointer's position in minimap-CSS-px, snapshot the current minimap view.
   Immediately recenter the main view on the world point under the cursor
   (so a single click without movement still recenters).
2. **`pointermove`** while captured: compute the world point under the
   pointer (using the minimap's view + the current pointer position) and
   recenter the main view on it. Recentering means setting
   `mainView.{x,y}` so the world point lands at the center of the main
   canvas — i.e.,
   ```
   mainView.x = worldX - (mainViewDims.width  / 2) / mainView.scale.x
   mainView.y = worldY - (mainViewDims.height / 2) / mainView.scale.y
   ```
   `mainView.scale` is unchanged. The minimap does not zoom the main view.
3. **`pointerup` / `pointercancel`**: release capture, clear drag state.

No threshold-drag distinction. Click and drag are the same gesture —
"continuously map pointer → recenter." A click that doesn't move just maps
once.

**Reuse of kit gesture primitives.** Internally this could ride
`thresholdDrag` or the bare pointer-capture helpers in
`src/interactions/gestures/`. Keeping the implementation self-contained
with native `addEventListener` is also fine — it's ~30 lines. **Decision:
self-contained.** No dependency on the gesture layer; if a future
refactor wants to consolidate, fine, but a one-off doesn't need the
abstraction surface.

### Re-render triggers

`<SceneViewCanvas>` and `<MinimapCanvas>` paint on:

- Initial mount.
- Any React re-render (prop change: `view` / `scene` reference / `drawOne`
  identity / `width` / `height` / etc).
- Scene mutation via `useSyncExternalStore(scene.subscribe, scene.getSnapshot)`
  — the same hook `<SceneCanvas>` uses. A scene `applyBatch` triggers a
  re-render automatically.

No RAF loop. Render is on demand; if the scene is static, the component
renders once per mount.

The minimap also re-renders when `mainView` or `mainViewDims` change (the
indicator rect depends on them) — those are React props, so prop-change
reconciliation handles it.

## Implementation notes

### File layout

```
src/canvas/SceneViewCanvas.tsx           # generic read-only view component
src/canvas/SceneViewCanvas.test.tsx
src/canvas/MinimapCanvas.tsx             # opinionated minimap, composes SceneViewCanvas
src/canvas/MinimapCanvas.test.tsx
src/canvas/sceneViewRender.ts            # shared helper: build the DrawCommand list for a scene+view+drawOne
demo/demos/MinimapDemo.tsx               # the new detached-minimap demo
```

`src/canvas/` is the right home — `<SceneCanvas>` and its supporting files
already live there. There's no separate `src/components/` directory in this
repo; trying to invent one would split related canvas code across two trees.

### Shared "render scene to a canvas" helper

`<SceneCanvas>` currently owns the GL context, the DPR-aware sizing, the
`drawOne`-iteration-over-scene loop, and the dispatch to the renderer. The
non-interactive subset of that — *given a scene, a view, a drawOne, and a
canvas, render once* — is what `<SceneViewCanvas>` needs.

The path forward: extract a small `sceneViewRender` helper (call it
`renderSceneToCanvas` or similar) that takes:

```ts
function renderSceneToCanvas<TData, TLayer, TPose>(args: {
  canvas: HTMLCanvasElement;
  scene: Scene<TData, TLayer, TPose>;
  view: View;
  width: number;
  height: number;
  drawOne: (n: Node<TData, TLayer, TPose>, pose: TPose, view: View) => DrawCommand[];
  background?: string;
  extraCommands?: DrawCommand[];  // appended after scene commands (used for the minimap indicator)
}): void;
```

…and reuses the same renderer that `<SceneCanvas>` uses. `<SceneCanvas>`
keeps its current call-site but routes through this helper (or stays as-is
if extraction is more invasive than worthwhile — the helper can start as a
*new* small function that duplicates the minimum needed, and we tighten up
the duplication only after `<SceneViewCanvas>` is in tree).

**Decision:** start by writing `renderSceneToCanvas` fresh as the smallest
thing that works (scene iteration + drawOne + renderer call), wire
`<SceneViewCanvas>` to it, and *don't* touch `<SceneCanvas>` in the same PR.
A follow-up can dedupe. This avoids a risky refactor of the main canvas's
render path on the critical path of shipping the minimap.

### GL context per component

Each `<SceneViewCanvas>` gets its own `WebGL2RenderingContext` from its own
`<canvas>` element. Browsers will refuse to create unbounded contexts (the
typical limit is 16 contexts before the browser starts losing the oldest),
but in the detached-minimap case we have *two* contexts (main + minimap),
which is well within limits. If a future consumer wants many tiny scene
previews on one page (a thumbnail grid), they can either accept the
contexts-per-canvas cost or, when the renderer grows offscreen-canvas
support, paint into a shared `OffscreenCanvas` and blit. That's a
future-renderer concern, out of scope.

### Indicator drawing

The simplest option: after iterating scene nodes through `drawOne`, the
minimap's render call appends one extra `DrawCommand` — the dashed-rect
described above. This is what `extraCommands` in the helper signature is
for. Doesn't need a separate "indicator layer" abstraction.

### CSS conventions

Per project rules (no inline styles, prefer classes):

- `<SceneViewCanvas>` accepts `className` for sizing/positioning.
  Components do not emit inline styles.
- `<MinimapCanvas>` ships a `MinimapCanvas.module.css` with default tokens:
  ```
  --minimap-indicator-stroke: #ffffff;
  --minimap-indicator-bg: rgba(0, 0, 0, 0.4);
  ```
  These default the corresponding props when those props are omitted.
  Consumers override via their own CSS (or the explicit prop).

## Open questions and defaults called out

1. **AABB-fill default drawOne?** *No.* Decided in advance. The kit can't
   pick fill vs. stroke vs. simplified-path-vs-AABB sensibly without knowing
   the consumer's intent. Mandatory `drawOne` prop.
2. **`fit={fn}` in v1?** *Yes, ship it.* It's a one-line union type
   addition; cost is trivial; without it consumers with non-rect "world
   extents" have no clean path.
3. **Should `<SceneViewCanvas>` expose the underlying `<canvas>` via ref?*
   *Yes* — `canvasRef` prop. Consumers want to snapshot for export.
4. **Should the indicator be hit-testable as a draggable handle?** *No, not
   in v1.* The whole canvas is the hit target; the indicator is purely a
   render. Adds zero pointer-routing complexity.
5. **Should the minimap zoom the main view?** *No.* `mainView.scale` is
   read-only from the minimap's perspective. If wheel-on-minimap-to-zoom
   becomes a real request, it slots in cleanly later as an additive
   pointer handler.
6. **Does the minimap participate in the main canvas's modality / mode
   preset?** *No.* It's a separate DOM element with its own listeners.
   Modes are a `<SceneCanvas>`-internal concern.
7. **Does the minimap share the main canvas's layers (selection overlay,
   guides, grid, etc.)?** *No, not in v1.* The minimap only paints scene
   nodes (through its `drawOne`) plus the visible-window indicator. If a
   consumer wants to also see selection halos in the minimap, that's their
   drawOne's problem. Threading the main canvas's layer config into the
   minimap is a substantial design surface (origin/space, screen vs.
   world, ordering vs. the indicator) and not what the v1 case needs.

## Alternatives considered

- **`insets` prop on `<SceneCanvas>` painting into the main drawing buffer.**
  This is the natural extension of `createViewportLayer`. We rejected it
  for the detached case: it can't position outside the main canvas's
  bounding box, can't scroll independently, can't be styled with normal
  CSS layout, and conflates two genuinely different products
  (HUD-overlay-on-canvas vs. sidebar-DOM-element). The superimposed
  pattern can stay; this spec doesn't replace it.
- **Single component with a `detached?: boolean` prop.** Combines the two
  designs by toggling whether the canvas is mounted inline or as a child
  of `<SceneCanvas>`'s render tree. Rejected because the prop set for
  "detached read-only thumbnail" and "interactive sidebar minimap" are
  almost disjoint — `<SceneViewCanvas>` has no `onMainViewChange`,
  `<MinimapCanvas>` requires it. The split is honest.
- **One component, with `interactive: boolean`.** `<SceneViewCanvas>` plus
  an `interactions` prop that conditionally adds the recenter handler.
  Rejected: the interactive case needs `mainView` + `mainViewDims` +
  `onMainViewChange` as required props, which makes them awkwardly
  optional-but-required-together. Splitting puts the type-level
  requirement at the right component.
- **Reuse the main canvas's GL context via shared `OffscreenCanvas`.**
  Premature. The browser-side cost of two contexts is fine for the
  detached case; sharing infrastructure is a renderer concern that
  unlocks other use cases too (thumbnail grids), best designed when those
  cases exist.
- **Plugin shape (`createMinimapPlugin(scene, ...)`).** Rejected as
  overbuilt for a one-off interaction with no extension surface.

## Scope cuts (explicit non-goals)

- **No superimposed-inset support in this work.** The existing
  `createViewportLayer` covers that case and stays as-is. No `insets` prop
  on `<SceneCanvas>`, no FBO substrate.
- **No generic `<Viewport>` for picture-in-picture.** The generic
  primitive needed for read-only views is `<SceneViewCanvas>`, which the
  consumer can stack and absolutely-position to taste. A higher-level
  `<Viewport>` (PiP with chrome, frame, label, close button…) is a layer
  for an app, not the kit.
- **No plugin / extension shape.** Both components are plain React
  components with props.
- **No tool / dispatcher participation.** The minimap is pointer-isolated
  from the main canvas. No Tool, no Action, no Interaction binding.
- **No selection rendering, no guides, no grid layer in the minimap.**
  v1 paints scene nodes plus the indicator. Anything else is via the
  consumer's `drawOne`.
- **No zoom-via-minimap.** Pan only.
- **No animated "fly to" on click.** Recenter is an instantaneous setter
  call.
- **No virtualization / culling for very large scenes.** The minimap iterates
  all scene nodes once per render. If a real consumer hits 10k+ nodes and
  notices, we add a culling pass; not before.

## Work breakdown

Roughly in dependency order. Each step is meant to land as its own PR
unless tiny.

1. **Renderer helper.** Write `renderSceneToCanvas` in
   `src/canvas/sceneViewRender.ts`. Smallest thing: takes a canvas, sets up
   a GL2 context (or reuses one cached on the canvas), iterates
   `scene.nodes` calling `drawOne`, optionally appends extra commands, and
   dispatches to the existing renderer. Unit-test by rendering into a
   mock canvas (via the renderer's existing test utilities) and checking
   the produced command list.
2. **`<SceneViewCanvas>`.** Write the component. Subscribes to scene via
   `useSyncExternalStore`. Calls `renderSceneToCanvas` in a layout effect
   on every render. Forwards `canvasRef`. Tests:
   - Renders a known scene with a known drawOne; produced commands match
     expected.
   - Re-renders on scene mutation (apply an op, assert the renderer ran
     again).
   - Re-renders on `view` change.
   - Resizing changes the drawing-buffer size and the CSS size.
3. **Minimap math helpers.** `computeFitView(scene, dims, fit, poseBounds)`
   and `computeIndicatorCommand(mainView, mainViewDims, minimapView, style)`
   in a pure module (e.g., `src/canvas/minimapMath.ts`). Unit tests
   exhaustively cover:
   - Fit-scene over empty / one-node / many-node scenes.
   - Fit-world for the four "rect dimensions vs. minimap dimensions" axis
     cases (wider, taller, square, exact).
   - Indicator rect math against the same cases
     `ViewportLayerDemo.tsx` already exercises.
4. **`<MinimapCanvas>`.** Compose `<SceneViewCanvas>` (rendered with the
   computed fit view + indicator drawn via `extraCommands`). Add native
   pointer listeners with `setPointerCapture` for click + drag → main view
   recenter. Tests:
   - Click at a known minimap-px coord recenters main view on the
     expected world point.
   - Drag fires `onMainViewChange` multiple times during pointermove.
   - `pointercancel` releases capture cleanly.
   - Indicator rect math matches the helper's output.
5. **Demo.** `demo/demos/MinimapDemo.tsx` — terse, single-purpose. Two
   canvases, sidebar layout, identical `drawOne` for both. Demonstrates
   click-recenter and drag-pan. Register in the demo index.
6. **Public API.** Export `SceneViewCanvas` and `MinimapCanvas` from
   `src/index.ts`. Update `index.barrel.test.ts`.
7. **Docs.** Brief README mention or doc note pointing at the new
   components and clarifying when to use them vs. `createViewportLayer`
   (detached vs. superimposed).

## ASCII sketch of the composition

```
┌────────────────────────────────────────────────────────────┐
│ App layout (consumer CSS — flex / grid / whatever)         │
│                                                            │
│  ┌──────────────┐   ┌──────────────────────────────────┐   │
│  │ <aside>      │   │ <main>                           │   │
│  │              │   │                                  │   │
│  │ ┌──────────┐ │   │  ┌────────────────────────────┐  │   │
│  │ │ Minimap  │ │   │  │     SceneCanvas            │  │   │
│  │ │ Canvas   │ │   │  │     (main GL context)      │  │   │
│  │ │ (own GL) │ │   │  │                            │  │   │
│  │ │          │ │   │  │                            │  │   │
│  │ │ ┌─ ─ ┐   │ │   │  │                            │  │   │
│  │ │ │  ◆ │ ← indicator rect           ◆ tracks      │  │   │
│  │ │ └─ ─ ┘   │ │   │  │     mainView.{x,y,scale}   │  │   │
│  │ └──────────┘ │   │  └────────────────────────────┘  │   │
│  │              │   │                                  │   │
│  └──────────────┘   └──────────────────────────────────┘   │
│         ↑                              ↑                   │
│   pointer events       pointer events                      │
│   isolated (browser routes by element under cursor)        │
└────────────────────────────────────────────────────────────┘

Two canvases. Two GL contexts. Pointer-independent.
MinimapCanvas drives main view via onMainViewChange.
```
