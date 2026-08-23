# Virtual viewports — design spec

**Date:** 2026-08-22
**Status:** Draft
**For:** whoever implements the decomposition.
**Answers:** how one canvas hosts N independent views, what stays singular, and how today's flat
props survive as the N=1 case.
**Package paths:** `packages/core/src/canvas/`, `packages/core/src/features/viewports/`,
`packages/core/src/interactions/dispatcher/`.

One `<canvas>` is one WebGL context, and browsers cap live contexts near 8–16. A lab that wants
sixteen panels cannot have sixteen `SceneCanvas` instances. It also should not want them: a
`WeaselRenderer` owns its compiled shader programs and its texture and glyph atlases
(`renderer/WeaselRenderer.ts:147-162`), so N canvases pay N times for the same font, and N
independent rAF loops make panels show different instants — which defeats the point when the panels
differ by one parameter.

This makes **view** a first-class concept separate from **canvas**: N cameras, N selections, N tool
states over one surface and one renderer.

## Start from what exists

`features/viewports/viewportLayer.ts` already draws nested views. `createViewportLayer` emits
`{ kind: 'group', transform, clip: rect, children }` re-running source layers under an inner `View`
(`:105-129`), and `reproject` (`:98-104`) and `viewportsAt` (`:120-152`) already do the inverse
mapping. It is `@experimental` and explicitly does not route input (`:25-30`).

**Clip groups, not scissor.** There is no `gl.scissor` or `SCISSOR_TEST` in the renderer; clipping
is stencil-based (`renderer/draw.ts:862-972`). Do not introduce a GL scissor path — extend the
mechanism already in the tree.

One consequence to design around: clip depth is capped around 7 levels and shares eight stencil bits
with even-odd fill (`renderer/draw.ts:992-1009`, `:1137-1174`), so a view's own clip spends one of a
small budget that its content also draws from.

The other, that `viewportLayer` drew source layers without the `viewToMat3(view)` wrap `drawLayers`
applies, was a real bug and is fixed — both go through `drawOneLayer` now.

## What stays singular

The renderer and everything it owns: GL context, shader programs, mesh/texture/image/gradient
caches, the quad buffers, `SolidBatch`, `GroupState`. The `<canvas>` element, its size and DPR. The
document- and element-level listener sets.

Both stay put as they are, as long as views remain clip groups inside one command tree. `SolidBatch`
merges rects across the whole command stream (`WeaselRenderer.ts:466`), and merging across a view
boundary would be a correctness bug — but `pushClip` and `popClip` each call `flushSolids` before
touching the stencil (`renderer/draw.ts:920`, `:954`), so a view's clip already drains the run.
Likewise the full-surface `gl.clear` and the `GroupState` reset happen once per `render()`
(`:433-437`), and N views in one command tree are still one `render()`.

Both only become problems under one `render()` per view. Don't go there.

## What becomes per-view

Camera (`View`, `viewBounds`, the pan/zoom/pinch controls), scene and its synthesized adapter and
pickers, selection and chrome state, tool registry and active tool, the gesture dispatcher's
in-flight handles, chrome visibility and hover, path/anchor editing state, and layer
visibility/order — which is new state, not a relocation: `Canvas.tsx:1437-1438` hardcodes `{}` and
`undefined` today.

**The layer command cache must become per-view.** It is keyed on `layer.id` alone and evicts ids
absent from the current list, so two views sharing an id thrash a single entry every frame, and two
views with different layer sets evict each other. Prefix the key with a view id, or hold one cache
per view. This waits on the layer caching arc: `LayerCommandCache` lives on branch
`worktree-renderer-layer-caching` and is not on `main`.

## The façade

`SceneCanvasProps` keeps its present flat shape. A consumer passing `scene`, `selection`, `tools`,
`view` and the rest never sees a `views[]` array; those fields are forwarded into an implicit view
zero. **This is a constraint from the first commit, not a wrapper added at the end** — a flat façade
retrofitted over a multi-view core becomes a lossy translation, and the single-view path is the one
every existing consumer is on.

Per-surface props stay on the outer component: `width`, `height`, `dpr`, `className`, `style`,
`tabIndex`, `shaders`, `debug`, `device`, `children`, and the keybinding/dispatcher enables.

`backgroundFill` is the awkward one — it is a screen-space rect sized to the full canvas
(`Canvas.tsx:1220-1232`). Per-view it needs the view's rect; leave it per-surface unless a view
wants its own ground.

## Input routing

There is no viewport-rect concept in the pointer path today. A resolver answering "which view owns
this client point" must run before world conversion and before `Canvas.tsx:1186`'s hover fan-out,
and it must be **sticky for a captured gesture** — a drag that leaves its view's rect keeps
targeting the view it started in, not the one under the cursor.

`clientToWorld` becomes view-aware: subtract the view's rect origin, not just the canvas's
`rect.left/top`. It is implemented four times — `SceneCanvas.tsx:2223-2240`, `SceneCanvas.tsx:
1449-1456`, `Canvas.tsx:1191-1201`, `Canvas.tsx:947-957` — of which only `clientToWorld.ts:24` is a
shared pure function. **Collapse the four onto one view-aware helper before changing behavior**;
four copies that must agree is how this breaks.

`buildAffordanceAt` already takes `getChromeState` and `getView` as thunks
(`canvas/affordanceAt.ts:92`), so retargeting it per view is cheap once a view is chosen. That is
the pattern to follow generally: the whole `RenderLayer` contract already threads `view` and `dims`
as arguments (`core/layers/render.ts:48`, `:63`, `:104-114`, `:122-128`), so the draw side is
mostly parameterized already. The input side is not.

## Public API that has to change

`CanvasExtensionApi` (`canvas/canvasExtension.ts:23-58`) is public and view-blind:
`registerLayer`, `hitTestExtras` and `requestRedraw` have no view argument, and `hitTestExtras`
reads singular `viewRef` / `dimsRef` / `getIsVisibleRef` (`Canvas.tsx:828-839`). `@weasel-js/hud`
consumes it. Adding an optional view argument keeps the N=1 call sites working.

`requestRedraw` is currently one nonce repainting everything (`Canvas.tsx:809`), and the paint
effect's deps include `effectiveView`, so one view's camera change repaints all views. Per-view
invalidation is the natural pairing with the per-view command cache.

## The entangled parts

**`helpersForLayers` is the hard one** (`Canvas.tsx:1134-1172`). It is simultaneously the `data`
argument to every layer's `draw` and `hitTest`, and the consumer's live `helpersRef` handle, and it
bundles per-view state (selection, chrome state, tools, gesture source) with per-surface state
(debug sink, `getIsVisible`). Splitting it is the centre of this work.

**One `Dispatcher` and one `ToolsApi` per `SceneCanvas`** (`SceneCanvas.tsx:1417-1423`, `:1300`).
Two views with different active tools needs either N dispatchers — then `getInFlightHandles()`
consumers at `:1641`, `:1699`, `:1869`, `:1884` and `createGestureSource` at `:1428` all take a view
— or one view-tagged handle set.

**Hook identity.** `SceneCanvas` runs an order-sensitive hook sequence including hooks deliberately
called-but-disabled to keep counts stable (`SceneCanvas.tsx:1185-1187`, `:2034-2041`). N views
cannot be a loop in a hook body. If N views become N component instances, the surface must be
hoisted above them, and `usePinchZoomTool`, `useGestureDispatcher` and `useHoverTracking` each
attach listeners to the same element — N instances means N listener sets all firing for every event.
That is why the view resolver sits **above** the per-view components, not inside each.

**Providers are "if root"** (`SceneCanvas.tsx:1937-1997`). With N views under one surface, the first
view's dep and actions registries could silently become shared by all views — and those registries
are where per-view state (`view.set`, selection, `editAnchors`) is looked up.

**Module-level globals** that N views would share: the dev coord trace (`SceneCanvas.tsx:193-199`),
the `window` test hook (`:1916-1934`), `adapterFallbackIdCounter` and `pasteIdCounter`
(`canvas/sceneAdapter.ts:230`, `:242`).

## Staging

**Arc 1 — draw.** Promote `viewportLayer` from experimental. The `viewToMat3` discrepancy is
settled; the `SolidBatch` and `gl.clear` items turned out to be non-problems (see *What stays
singular*). What remains is keying the layer command cache per view, which waits on the layer
caching arc — `LayerCommandCache` is not on `main` yet. Delivers N panels that render, with input
still single-view: most of the comparison use case.

**Arc 2 — input.** Done. The copies are collapsed, `createViewResolver` exists, and
`hitTestExtras` takes an optional view frame; `buildAffordanceAt` needed nothing, being already
thunked on `getView`. The resolver is not wired into the pointer path, because with one dispatcher
every point resolves to the root view — wiring it is Arc 3's first payoff, not Arc 2's.

**Arc 3 — per-view interaction.** Split `helpersForLayers`, then N dispatchers and N tool
registries, then per-view selection and chrome. Started: the type is split into
`CanvasViewHelpers` + `CanvasSurfaceHelpers` and `<Canvas>` builds the halves separately. The
per-view half still closes over `chromeState`, so hoisting it into an N-callable factory means
dealing with that first.

Each arc ends somewhere shippable. Arc 1 alone is worth having.

## Testing

Headless against command trees, as the existing layer tests do — no WebGL in the suite.

- A layer id shared by two views does not serve one view's commands to the other.
- Two views with different layer sets do not evict each other's cache entries.
- A drag begun in view A and moved over view B keeps reporting world coordinates in A's space.
- A click in view B does not disturb view A's selection.
- Flat props with no views declared behave identically to today — the N=1 façade, asserted against
  the existing `SceneCanvas` tests unchanged.
- A world-space source layer's commands carry the inner view's transform, not the outer's.
