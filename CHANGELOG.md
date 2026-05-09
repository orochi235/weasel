# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### WebGL2 backend (`@experimental`)

- New workspace package `@orochi235/weasel-gl` housing the GL2 renderer.
- `WeaselRenderer` with WebGL2 context lifecycle, DPR-aware resize, and
  context-loss/restore handling.
- `<Canvas>` / `<SceneCanvas>` accept `backend?: '2d' | 'gl'` (default `'2d'`).
  Warn-once on post-mount backend change. The `background` prop is honored under
  `backend='gl'`.
- Path tessellation via earcut for `nonzero` fills; stencil two-pass for
  `evenodd`. WeakMap path-mesh cache; rect fast-path with shared VBO.
- Strokes: ribbon-mesh expansion with bevel/miter/round joins, butt/square/round
  caps, miter limits, dash patterns, and full `StrokeAlign` (`center`/`inner`/
  `outer`) — inner/outer via stencil clip on `PolygonPath` and
  `alignedStrokeRect` on `RectPath`. New exports: `tessellateStroke`,
  `extractPolylines`, `StrokeAlign`, `alignedStrokeRect`.
- Text via MSDF atlases. `registerFont(family, atlasUrl)` public API. Prebuilt
  Inter v4 atlas ships with `weasel-gl/fonts/`. `pnpm gen:font` script wraps
  `msdf-bmfont-xml` for custom atlases.
- Image, pattern, and gradient paints. New `Paint` variants:
  `linear-gradient`, `radial-gradient`, `conic-gradient` with `GradStop[]`.
  `GLImageCache` (WeakMap-keyed) and `GradientRampCache` (1×256 textures).
- Per-vertex colors: `vertexColors?: number[]` on `kind: 'path'` `DrawCommand`.
- Color matrix: `colorMatrix?` (4×5 row-major) on `kind: 'group'`. Composes
  through nested groups via `compose4x5`. `IDENTITY_COLOR_MATRIX` export.
- Custom shader API (`@experimental`): `registerProgram(id, vert, frag)`,
  `registerTexture(image)`, opaque `ShaderProgramHandle` / `TextureHandle`,
  `kind: 'shader'` `DrawCommand` with uniform map (`number`, `vec2..4`, `mat3`,
  `mat4`, `texture`). Auto-quad geometry over `bounds`; vertex prelude exposes
  `v_uv` / `v_screen` / `v_world` varyings.
- `RenderLayer` gained additive `drawGL?` and `Dims`. `viewToMat3` helper for
  layers translating `View` to GL transform. Eight built-in layers ported:
  `createPathLayer`, `createTextLayer`, `createGridLayer`,
  `createSelectionOverlayLayer`, `createCellHighlightLayer`,
  `createChildrenLayer`, `createPenPreviewLayer`, `createDebugOverlayLayer`.
- `SceneSlotConfig.drawOneGL` to render scene content under `backend='gl'`.
- Tool overlays render under GL: `useSelectTool` / `useCloneTool` gained
  `drawGhostGL` and `drawOneGL` options; drag-insert overlay renders under GL.
- Visual-regression rig (Playwright + pixelmatch) with per-pixel
  `threshold: 0.1` and `< 2%` pass criterion. Per-demo specs (~24 demos);
  pinned to `ubuntu-22.04`. Dedicated CI workflow (manual trigger). Demo
  supports `?backend=` query string via `BackendContext`.
- Bundle-size CI gate fails on `weasel-gl` prod-bundle delta > 50 KB.

#### Actions registry (`@experimental`)

- `<ActionsProvider>` mounts a single keydown listener and dispatches to a
  central registry. `useActionsRegistry()` and `useAction(action)` hooks.
- Default action factories: `defaultSelectAllAction`, `defaultEscapeAction`,
  `defaultDuplicateAction`, `defaultNudgeActions` (8 bindings),
  `defaultReorderActions` (2 bindings).
- `<SceneCanvas>` auto-mounts a provider when none exists upstream and
  auto-registers the default action set, derived from `scene` / `selection` /
  `adapter`. New `actions` prop accepts `null` (disable all), partial override
  by id, or full `Action` descriptors for new ids.
- `useStandardActions(adapter, scene, selection)` registers the same default
  set for bare-`<Canvas>` consumers.
- Public types: `Action`, `ActionEntry`, `ActionsProp`, `ActionsRegistry`,
  `KeyBinding`.

#### Other

- Plain scroll wheel zoom in `SceneCanvas.viewport`; trackpad pinch fix.
- `useHandTool` moved into the tool registry; `useKeybindings` wired through
  `SceneCanvas`.
- Momentum animation gained bounds + stop-on-edge policy.
- `ViewportDemo` and animation-stress visual harness (100 drag cycles under
  `backend='gl'`).
- Demo sidebar shows the weasel logo (transparent variant).
- npm scripts `test:changed` and `test:related` for fast inner loops.

### Changed

- `RenderLayer` interface gained an additive `drawGL?` method (no breaking
  change to the existing `draw`). Through step 9 both signatures coexist; the
  step-10 final swap collapses to a single `draw` and removes the 2D path.
- `<SceneCanvas>` now auto-wires viewport tools and the default actions set
  internally. Demos using `useSelectAll` / `useEscape` / `useDuplicate` /
  `useNudge` / `useReorder` directly under `<SceneCanvas>` are now redundant
  (the standalone hooks still work — they register into the auto-provider —
  but can be deleted).
- Standalone action hooks (`useSelectAll`, etc.) register into the parent
  `ActionsProvider` when present and fall back to direct `useKeybinding` when
  not. Bare-`<Canvas>` behavior is unchanged.
- `SceneCanvas.tsx` split into focused submodules.
- 2D `applyPaint` / `applyStroke` handle the new gradient `Paint` variants by
  falling back to opaque black; gradients render only under `backend='gl'`
  in v1.
- `weasel-gl` tessellator now handles compound paths with multiple positive
  contours; orphan opposite-wound contours are promoted to independent
  positives. Uses first-contour winding as the reference, not signed-area sign.
- Rect-path GL caching keyed on dimensions, not `Path` identity, so equivalent
  rects share meshes across nodes.

### Fixed

- `useAnimator` now cleans up on unmount; tripwire test guards regressions.
- `animateOnSetPose` short-circuits when a tween is already in flight and
  detects re-entry from any animator tick.
- WebGL: stop register-thrash with a `FinalizationRegistry` cleanup pass,
  later disabled (use-after-free risk) in favor of transient + deferred-delete
  pools that prevent GL buffer leaks.
- WebGL: rect fast-path uses a shared VBO to eliminate per-frame allocations.
- WebGL: premultiplied-alpha output paired with matching `blendFunc`; request
  stencil buffer at context creation; canvas CSS size set on resize.
- WebGL: miter join now emits both apex extension and inner bevel half;
  `splitForDash` honors closed polylines.
- Canvas action key dispatch test coverage added; tool-overrides-default and
  same-id-collision semantics covered.
- BezierEditDemo: `pickEvery` uses AABB+slop so clicks hit the curve;
  `applyOps` added to adapter so area-select wires; `hitTestArea` added so
  drag-marquee selection works.
- Three TS errors blocking `prepublishOnly` resolved.
- `circle`-approximation command-stream lengths corrected in `layers`.
- Visual CI gates on manual trigger only (not every PR/push), avoiding noisy
  cross-platform pixel diffs.

### Deprecated

- The `backend='2d'` codepath is on a deprecation runway. Once the visual
  soak completes, the default flips to `'gl'`; in a follow-up major release
  the 2D path (`paint.ts`, `setupCanvasDpr`, `useFixedPixelRatio`, the
  `RenderLayer.draw(ctx, …)` 2D signature) is removed and `weasel-gl` folds
  back into `weasel`.

## [Pre-Unreleased] — viewport, debug overlays, layout strategies

The following entries predate the WebGL transition but were never tagged.

### Breaking

- `createReparentOp` arg names changed: `from` → `fromParentId`,
  `to` → `toParentId`. Update call sites accordingly.
- `View` now includes `scale: number` (default 1). `viewToTransform` now
  produces `{ panX: -view.x*scale, panY: -view.y*scale, zoom: scale }`.
- `RenderLayer.draw` signature is `(ctx, data, view) => void`. `runLayers`
  accepts an optional `view` (defaults to identity) and wraps world-space
  layers with `setTransform(scale, 0, 0, scale, -x*scale, -y*scale)`;
  screen-space layers get an identity transform.
- `SceneSlotConfig.drawOne` (and `DefaultLayersScene.drawOne`) signature is
  `(ctx, obj, pose, view) => void`.
- `handleHitRadius` is now interpreted in **screen pixels**: divided by
  `view.scale` at each hit-test site so the hit area matches the rendered
  handle size under zoom.
- `usePan` is removed. Use `useHandTool` for drag-pan and `useWheelPanTool`
  for wheel-pan.

### Added

- `LayoutStrategy<TPose>.contains?(containerPose, point)`: optional non-AABB
  containment predicate. `useMove`'s layout-pass hit-test consults it when
  present, falling back to an AABB check on the container's pose.
- `createReparentOp` defaults `coalesceKey` to `reparent:${id}` so successive
  reparents of the same id batch-merge cleanly. Default `label` is
  `'Reparent'`. Layout strategies can return reparent ops from `commitDrop`.
- `tileGrid({ cellToPose })`: optional callback to map a cell rect + the
  dragged pose to the new pose. Default spreads `{x,y,width,height}` over
  the dragged pose. The `tileGrid<TPose>` signature is no longer constrained
  to `RectPose` — pass `cellToPose` whenever TPose doesn't carry rect fields.
- `useMove` layout-pass picks the top-most container in z-order when the
  adapter implements `OrderedAdapter.getChildren`.
- Debug overlay subsystem: `?debug=…` URL gating + `<Canvas debug={...}>`
  prop. Six features ship: `hitboxes`, `handles`, `bounds`, `origins`, `snap`,
  `layers`. Sink threaded through `usePointerGestures`, `useResize`,
  `useRotate`, `useAreaSelect`, `useEditAnchors`, `useSelectTool`, and
  `gridSnapStrategy`.
- New exports: `parseDebugFlags`, `createDebugSink`,
  `createDebugOverlayLayer`, `DEFAULT_DEBUG_THEME`; types `DebugConfig`,
  `DebugSink`, `DebugFeature`, `DebugTheme`, `HitShape`, `HandleKind`.
- `zoomAt(view, anchor, factor, opts?)` pure primitive shared by every zoom
  path.
- `useWheelZoomTool` (alwaysOn, claims wheel when `ctrlKey`/meta is held;
  anchors zoom at cursor).
- `useWheelPanTool` (alwaysOn, claims plain wheel; translates view by
  `delta / scale`).
- `useKeyboardZoomTool` (alwaysOn; `Cmd+=` / `Cmd+-` / `Cmd+0`; anchors at
  canvas center).
- Selection overlays, insert overlay, and area-select overlay run in
  `space: 'screen'` so chrome stays at fixed pixel size under zoom.
- `ZoomDemo` showcases the new tools and screen- vs world-pinned strokes.

## [0.1.0] — 2026-05-03 — Pre-Scene milestone

Pinned ahead of the `useScene` redesign (see `docs/proposals/useScene.md`)
so the pre-Scene state is diffable. Highlights of the surface at this point:

- `<Canvas>` with explicit `adapter` prop, plus inline-props shorthand
  (`items`/`setItems`/`toPose`/`fromPose`/`createDefault`/...) that synthesizes
  an `arrayAdapter` for flat-list scenes.
- Move, resize, insert, area-select, rotate, clone, group (virtual + nested),
  text-edit, and selection-driven action hooks (escape, select-all, duplicate,
  nudge, delete, reorder, clipboard, undo/redo).
- Path poses as a first-class alternative to rect poses (`pathPoseDescriptor`,
  `composePath`, `polygonFromPoints`, `PathBuilder`, `pointInPath`,
  `traceToContext`).
- Text rendering with caret/selection theming, contenteditable in-place edit,
  glyph-position hit testing, `fitTextPose` autosize helper.
- `RotatedPose` extension and `useRotate` gesture; rotation handle on selection
  overlay.
- `UnitSystem` / `UnitValue` for customizable units.
- Grid overlay with cell-hover hook + highlight layer.
- Quadtree demo, compound-paths demo, bezier control-point editing demo.

Extracted from [garden](https://github.com/orochi235/garden)
(`src/canvas-kit/`) as a standalone package on 2026-05-01.
