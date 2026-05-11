# weasel-hud design

**Date:** 2026-05-10
**Status:** Spec — ready for plan

## Problem

weasel today renders scene content via WebGL but ships every UI widget — toolbars,
property panels, sliders — as DOM/React in `@orochi235/weasel-ui`. That works, but
two things make a parallel WebGL-rendered widget kit feel inevitable rather than
optional:

1. **Performance.** DOM overlays paint on a separate compositor layer from the GL
   canvas; coordinated motion (e.g. a draggable knob that should track a path
   handle exactly during pan/zoom) gets sub-pixel jitter and an extra frame of
   latency. Drawing the widget into the same canvas, in the same frame, sidesteps
   both.
2. **Spatial integration.** Widgets that want to live in *world* space (orbiting a
   scene node, anchored to a path point) are awkward as DOM. CSS transforms can
   approximate it, but layering, hit-testing, and crisp rendering at sub-pixel
   positions all degrade.

There is no current consumer demanding this. The motivation is exploratory plus a
strong hunch that we'll want it. The spec is sized accordingly: small surface,
clean foundation, easy to grow.

## Goal

Stand up `@orochi235/weasel-hud` as a peer workspace package that:

- Renders UI widgets directly into a weasel canvas via the existing renderer
  pipeline.
- Ships a v1 widget catalog that is just large enough to validate the design:
  three primitives (`rect`, `text`, `image`), one interactive widget (`button`),
  and one passive widget (`label`).
- Provides an imperative, retained-mode API: widgets are persistent objects
  the consumer holds references to and mutates.
- Stays vanilla TypeScript at its core — no React dependency. A thin
  `@orochi235/weasel-hud/react` subpath supplies a `useHud` hook for React
  consumers.
- Pre-empts the canvas's tool input dispatch so widget clicks work regardless
  of which tool is active.
- Renders in **screen space** for v1; world-space widgets are a deliberate v2
  concern that the design accommodates without API churn.

## Settled design choices

The shape of the package is the result of a brainstorming pass; capturing the
decisions here so the plan and implementation don't relitigate them.

| Axis | Choice | Notes |
|---|---|---|
| Motivation | Exploratory + perf hunch | Don't over-scope. |
| Spatial model | Screen-space v1 | World-space later; same machinery, different transform. |
| v1 widgets | `rect`, `text`, `image`, `button`, `label` | Smallest set that surfaces the input-claim contract. |
| API style | Imperative builder | Returns widget instances; consumer holds refs. |
| Lifecycle model | Retained | Immediate-mode helper can layer on later. |
| Framework | Vanilla core; React subpath | `@orochi235/weasel-hud/react` for `useHud`. |
| Canvas attach | `attachHud(canvasEl, hud)` | Vanilla; React hook wraps it. |
| Internal model | Widget protocol (object with `draw`/`hitTest`/`onPointer`) | Each widget kind implements the protocol; HUD walks a flat list. |
| Text | MSDF, default Inter atlas auto-registered on attach | Reuses the renderer's existing font path. |
| Theming | None in v1 | Inline style props per widget. **Theme system is the planned v1.5.** |

## Architecture

### Package layout

```
packages/weasel-hud/
  package.json
  tsconfig.json
  README.md
  src/
    index.ts            # public barrel (createHud, attachHud, types)
    hud.ts              # Hud orchestrator
    widget.ts           # Widget protocol + types
    attach.ts           # attachHud(canvasEl, hud) → host wiring
    host.ts             # HudHost interface
    drawCtx.ts          # HudDrawCtx — passed to widget.draw
    fonts/
      default-atlas.ts  # Inter atlas auto-registration helper
      inter.json        # bundled metrics (or re-exported from assets/)
      inter.png         # bundled atlas
    widgets/
      rect.ts
      text.ts
      image.ts
      label.ts
      button.ts
      *.test.ts
    react/
      index.ts          # subpath entry: useHud, etc.
      useHud.ts
    integration.test.tsx
```

### Public API

```ts
import { createHud, attachHud } from '@orochi235/weasel-hud';

const hud = createHud();

const save = hud.button({ x: 10, y: 10, w: 80, h: 24, label: 'Save' });
save.on('press', () => doSave());

const status = hud.label({ x: 10, y: 40, text: 'idle' });

// later
save.setLabel('Saving…');
status.setText('done');
save.dispose();

const detach = attachHud(canvasEl, hud);
// detach() to unwire (or useHud handles it in React)
```

**Widget instances** share a base shape:
- `id: string` (stable across the widget's lifetime)
- `setBounds({ x, y, w, h }): void`
- `setHidden(hidden: boolean): void`
- `dispose(): void` — equivalent to `hud.remove(widget)`
- `on(event, handler): void` / `off(event, handler): void`

Plus type-specific setters: `button.setLabel`, `label.setText`, `text.setText`,
`image.setImage`, `rect.setFill`, etc. Inline style props (`fill`, `borderColor`,
`textColor`, `font`) are accepted at creation and mutable via setters.

**Events** in v1:
- `button`: `press`, `hover`, `leave`
- Other widgets: none in v1

Hover/leave are dispatched via `RenderLayer.onUncapturedMove` / `onUncapturedLeave`,
a generic canvas-level channel that fires on pointermoves when no gesture is
captured. Not specific to weasel-hud — any layer can use it.

### Internal model

Three layers, isolated:

**`Hud`** owns an ordered array of `Widget` instances and a dirty flag. Insertion
order is z-order — last added is drawn last (on top) and hit-tested first.
Exposes the public widget factories, maintains widget identity, dispatches
events to widgets, and forwards redraw requests to the bound host.

**`Widget` protocol** — every widget kind conforms to:

```ts
interface Widget {
  readonly id: string;
  readonly bounds: { x: number; y: number; w: number; h: number };
  readonly hidden: boolean;
  draw(ctx: HudDrawCtx): DrawCommand[];
  hitTest(x: number, y: number): boolean;             // screen-space CSS px
  onPointer(evt: HudPointerEvent): 'claim' | 'pass';
  dispose(): void;
}
```

Each widget kind lives in its own file (`widgets/button.ts`, `widgets/label.ts`,
…). No inheritance. `HudDrawCtx` carries:
- canvas dims (CSS px) for edge-anchored layout in future versions
- the default font handle (`'weasel-hud-default'` registered by `attachHud`)
- helper functions: `measureText(family, size, str)` and similar
- the widget's own current state (passed implicitly via `this`)

Widgets do *not* see the `view` argument — screen-space layers run at identity
transform and don't need camera state.

**`HudHost`** — the only thing weasel-hud knows about its environment:

```ts
interface HudHost {
  requestRedraw(): void;
  registerLayer(layer: RenderLayer<unknown>): () => void;       // detach
  installPointerInterceptor(handler: PointerInterceptor): () => void;
}

type PointerInterceptor = (evt: PointerEvent) => 'claim' | 'pass';
```

`attachHud(canvasEl, hud)` constructs a host bound to that canvas (lifting the
redraw + layer-stack + pointer-intercept hooks the canvas exposes), and hands it
to `hud.bind(host)`. The HUD package never imports anything from `src/canvas/`
or `src/tools/` — only `DrawCommand` from `src/renderer` and `RenderLayer` from
`src/core/layers/render`. Dependency direction stays one-way.

### Canvas extension API (precondition)

`HudHost`'s three operations are not on the canvas's external surface today.
Landing weasel-hud requires weasel core to expose them as a deliberate
extension API. Sketch:

```ts
// on the SceneCanvas instance / ref
canvas.requestRedraw(): void;
canvas.registerLayer(layer: RenderLayer<unknown>): () => void;
canvas.installPointerInterceptor(handler: PointerInterceptor): () => void;
```

These are useful beyond weasel-hud — debug overlays, async asset loaders, and
future scene-bound tools all want the same hooks. The plan should land the
extension API as its own discrete piece of work *before* implementing
weasel-hud, not bundled into the same change.

## Data flow

### Render

Per frame the canvas redraws:

1. Canvas walks its layer stack, hits the HUD's `RenderLayer<unknown>` (registered
   with `space: 'screen'`), calls `layer.draw(_data, _view, dims)`.
2. The HUD layer iterates its widget list in **insertion order** (bottom-to-top
   z-order), skipping hidden widgets, calls each widget's `draw(ctx)` and
   concatenates the returned `DrawCommand[]`s.
3. Renderer dispatches the commands. HUD's `dirty` flag clears.

### Mutation

1. `save.setLabel('Saving…')` mutates the widget's internal state and calls
   `host.requestRedraw()`.
2. The canvas schedules a redraw on the next animation frame.

### Input

1. Pointer event arrives at the canvas DOM.
2. Canvas's input pipeline calls the registered HUD interceptor *before*
   `tools.dispatcher`.
3. HUD walks its widget list in **reverse** order (top-to-bottom), calling
   `hitTest(x, y)`. First widget that returns true is the candidate.
4. HUD calls `candidate.onPointer(evt)`. The widget mutates its internal state
   (`pressed = true`), fires its public events (`save.emit('press')`), returns
   `'claim'`.
5. HUD returns `'claim'` from the interceptor → canvas suppresses the event from
   `tools.dispatcher`.
6. If no widget claims, interceptor returns `'pass'`; tools see the event normally.

### Pointer capture

When a widget claims a `pointerdown`, the HUD installs window-level `pointermove`
and `pointerup` listeners that route exclusively to that widget until release.
Standard drag-capture pattern, identical to weasel's tool gestures. Means
dragging off a button cancels the press cleanly. On `pointercancel` (or window
blur), the HUD calls `onPointer({type:'cancel'})` so the widget can roll back.

### Hover

Pointermoves with no captured widget walk the widget list, find the topmost
hit, and fire `onPointer({type:'hovermove'})` on the new hit and
`onPointer({type:'hoverleave'})` on the previous hit. Redraw is requested
**only when the hovered widget changes**, not on every pixel of motion — hover
state visually stable while inside a single widget should not cause redraws.

## Errors & edge cases

| Case | Behavior |
|---|---|
| Bad widget options at creation (e.g. `w <= 0`) | Throw with a clear message. Programmer error; fail loud. |
| Default font not yet loaded | Renderer's existing fallback (warn + skip glyph) takes over; once font lands, next redraw paints normally. Boot window is typically one frame. |
| Multiple HUDs on one canvas | Throw from `attachHud`. v1 supports a single HUD per canvas. Lift this when there's a real use case. |
| Use-after-detach (mutator on detached HUD) | No-op + `console.warn`. Matches React's "setState on unmounted" tone — friendlier in error paths. |
| Use-after-dispose (mutator on disposed widget) | Throw. No defensible reason to keep using a disposed reference. |
| Pointer capture loss (browser cancels) | `onPointer({type:'cancel'})` to the captured widget; press state rolls back. |
| Renderer context lost / restored | Inherits the renderer's existing context-loss handling. HUD widgets don't hold GL resources directly — they emit DrawCommands; the renderer owns textures and programs. |

## Testing

**Per-widget unit tests** (`widgets/<kind>.test.ts`):
- `draw()` — `DrawCommand[]` snapshot for representative props + state. Catches
  unintended visual regressions without a real GL context.
- `hitTest()` — points inside, on edges, outside; `hidden` widgets never hit.
- `onPointer()` — pressed → release-inside fires `press`; release-outside
  cancels; hover transitions correct; `cancel` during press rolls back.

**Hud orchestration tests** (`hud.test.ts`):
- Add / remove / dispose maintains the list correctly.
- z-order: hit-test reverses insertion order. (`bringToFront` / `sendToBack`
  are v1.5; out of scope for v1 tests.)
- Dirty propagation: every mutator results in exactly one `requestRedraw` call
  on a mock host (or coalesces to one per frame).
- Bound / unbound: mutators on an unbound HUD no-op with `console.warn`.

**Integration test** (`integration.test.tsx`):
- Real `<SceneCanvas>` in jsdom with a mocked GL context (existing
  `src/renderer/test-utils/`).
- Attach a HUD, add a button, simulate a `pointerdown` inside its bounds.
- Assert `press` fires; assert `tools.dispatcher.onPointerDown` is **not**
  called for that event.
- Simulate the same `pointerdown` outside the button. Assert `press` does not
  fire; assert `tools.dispatcher` *is* called.
- This is the test that proves the input-claim contract end-to-end.

**Default-font test.** `attachHud` triggers `registerFont`; mock `fetch` to
verify the right URLs are hit and the registration completes before the next
draw.

**Out of scope for v1.** Pixel-diff / visual regression. DrawCommand snapshots
prove the protocol contract; pixel correctness is the renderer's responsibility
and is covered there.

## Out of scope for v1

- **Theme system.** Planned for v1.5, immediately after v1 ships. Inline style
  props per widget are the v1 mechanism.
- **World-space widgets.** Same machinery (RenderLayer, widget protocol), different
  transform. Specific design deferred.
- **Layout helpers.** v1 widgets take absolute screen-space coords. Auto-layout
  primitives (rows, stacks, edge-anchored positioning via `dims`) are a separate
  concern.
- **Focus, keyboard input, text input widgets.** Hit-testable widgets only in v1.
- **Container widgets / nesting.** The widget protocol allows a container kind
  (a widget that owns children and proxies hit-test/draw to them) without
  protocol changes; v1 ships none.
- **Multiple HUDs per canvas.** Architecturally fine, deferred until needed.
- **Immediate-mode helper API.** Layers cleanly on the retained core when wanted.
- **Pixel-diff visual regression tests.**
- **CJK / extended glyph coverage.** Inherits the renderer's atlas (ASCII +
  Latin-1).

## Open questions

These are deliberate non-decisions that the implementation plan can resolve.

1. **Default-font binary location.** Bundle `inter.json` + `inter.png` as files
   inside the package, or re-export from the existing `assets/fonts/inter/`?
   The latter ties weasel-hud to the repo's asset layout; the former duplicates
   ~210KB but keeps the package self-contained. Decision can wait for plan.
2. **Widget id assignment.** Auto-generated (`hud-button-001`) or
   consumer-supplied? Auto is simpler v1; consumer-supplied is needed if we
   ever want to persist HUD state across re-creations (e.g. tool-mode-driven
   widget swaps). v1: ids are auto-generated and exposed read-only on the
   instance; the `id` factory arg is not part of the v1 API.
3. **`registerLayer` ordering.** Does the HUD always land on top of the layer
   stack, or is z-position configurable? On top is the right default; making it
   configurable is trivial later.
4. **Renderer-types import path.** weasel-hud needs `DrawCommand` (from
   `src/renderer`) and `RenderLayer<unknown>` (from `src/core/layers/render`).
   weasel core's main barrel does not currently re-export those, and vitest's
   `/^@orochi235\/weasel\/(.*)$/` alias routes `@orochi235/weasel/renderer` to
   `src/subpaths/renderer.ts` (which doesn't exist). Three plausible fixes:
   add a `subpaths/renderer.ts` re-export, widen the main barrel to include
   the types, or have weasel-hud import via package-relative paths once the
   monorepo is fully wired. Plan picks one.
