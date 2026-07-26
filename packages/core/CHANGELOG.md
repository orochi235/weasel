# Changelog

## 0.5.0

### Minor Changes

- 7e1982f: Publish the sub-packages. `@weasel-js/geom`, `/gestures`, `/history`, `/modes`,
  `/svg`, `/d3`, `/theme`, `/ui`, and `/hud` are now real published packages
  rather than source inlined into `@weasel-js/core`'s bundle.

  For consumers of `@weasel-js/core` this is close to transparent — the public
  API is unchanged and the sub-packages install as dependencies. It matters if
  you were using any of those packages' types indirectly, or if you want to
  depend on one alone: the geometry kernel (`@weasel-js/geom`) and the headless
  undo engine (`@weasel-js/history`) are dependency-free and usable without the
  React canvas.

  The change also removes a latent duplicate-module hazard: while the packages
  were inlined, a consumer holding both `@weasel-js/core` and one of them would
  have gotten two copies of it.

  `@weasel-js/ui` ships its styles as one bundled stylesheet — import
  `@weasel-js/ui/style.css`. `@weasel-js/theme` exposes its tokens at
  `@weasel-js/theme/tokens.css`.

### Patch Changes

- @weasel-js/geom@0.5.0
- @weasel-js/gestures@0.5.0
- @weasel-js/history@0.5.0
- @weasel-js/modes@0.5.0

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## 0.4.0 — 2026-06-15

### Breaking changes

- **npm scope migrated `@orochi235/*` → `@weasel-js/*`.** The root package is
  now `@weasel-js/core` (was `@orochi235/weasel`); the `weasel-` prefix was
  dropped from the workspace sub-packages and their directories renamed. The
  orochi235 GitHub URLs and author field are intentionally retained — this is
  an npm-only move.
- **Membership-group apparatus removed.** The old `Group` record / `GroupAdapter`
  are gone. `group` / `ungroup` now create and dissolve a structural
  `ContainerNode` (`kind: 'container'`) and reparent the selection under it; the
  container persists in the scene tree and round-trips to SVG `<g>`. A _saved
  selection_ is just a consumer-held `string[]` passed to `selection.set` — it is
  no longer a scene entity. See `docs/taxonomy.md` ("Group vs Selection").
- **`LayoutStrategy` renames:** `getChildPositions` → `childPoses`,
  `reflowFor` → `reflowPoses`. Update implementations and call sites.

### Added

- **Move behavior pipeline.** `useMove` runs an ordered `opts.behaviors`
  pipeline over a scene-backed gesture adapter, so consumers can compose
  move-time effects (snap, layout reflow, …) instead of forking the tool.
  Threaded through the select binding via `move.behaviors`.
- **Drag-time layout reflow.** A move into a layout container now runs a
  reflow pass that folds sibling poses into the preview channel during the
  drag, and commits via the strategy's `commitDrop` plus source-reflow ops.
- **`Scene.loadState`** — in-place restore of a serialized snapshot (extracted
  `applyConstructionSpecs` / `specsFromSerialized` for reuse).
- **`measureTextBounds`** — atlas-based text measurement against the MSDF font
  registry.
- **labkit absorbed into the monorepo** as the `packages/labkit` workspace
  package (published as `@lab-kit/react`), with its own CI wiring, smoke test,
  and Storybook/Pages docs unification.
- Dispatcher dev tooling: a live dispatch-trace widget in ToolkitBuilder, and
  `enableKeybindings` now also gates the dispatcher key channel.
- New `MoveSnapDemo` exercising container-snap + snap-back.

### Build / tooling

- `.d.ts` emission via `rollup-plugin-dts` with the alias pipeline; tsup code
  splitting enabled so entry points share a single font registry; the
  `@weasel-js/*` sub-packages are bundled into `dist` for publish.
- CI actions bumped off Node 20 (checkout v6 / setup-node v6 / pages v5);
  residual React `act()` warnings cleaned up at their call sites; visual
  baselines re-captured from `ubuntu-22.04`.

### Deprecated

- `Canvas` is now marked `@internal` / `@deprecated` and dropped from the
  README. Use `<SceneCanvas>` over a `useScene()` tree instead. The export
  is retained for this minor version and will be removed in the next.
  Bare `<Canvas>` has no scene-mutation signal, so high-frequency repaints
  must force React re-renders, which can wedge the tools machinery.

## 0.3.0 — 2026-05-09

### Added

- `Canvas` / `SceneCanvas` `shaders?: ShaderProgramHandle[]` prop — registers
  custom shader programs on the underlying renderer at init time and on
  prop change. Pairs with the experimental `registerProgram` /
  `ShaderDrawCommand` API. Pass a stable (e.g. module-scope) array
  reference; the prop is keyed by the joined handle ids so an inline literal
  won't trigger recompiles each render.

### Fixed

- `extractUniformNames` (the helper that pre-populates uniform locations for
  custom shader programs) now expands array uniform declarations into per-slot
  names. A shader declaring `uniform vec3 u_ripples[8];` previously produced
  no entries — neither `u_ripples` nor `u_ripples[0]`...`u_ripples[7]`.
  Consumer-side `ShaderDrawCommand.uniforms` keyed `'u_ripples[i]'` would
  silently fail to bind. Array uniforms now resolve correctly per slot.

## 0.2.0 — 2026-05-09

### Breaking changes (final WebGL swap — Step 10)

- **2D backend removed.** `<Canvas>` and `<SceneCanvas>` no longer accept `backend?: '2d' | 'gl'`. WebGL2 is the only backend. The kit's existing `background`, `view`, `scene`, etc. props are unchanged; just the `backend` switch is gone.
- **`@weasel-js/gl` deleted as a separate package.** All renderer source folded into `@weasel-js/core`:
  - GL machinery → `src/renderer/` (`WeaselRenderer`, `draw`, `state/`, `math/`, `cache/`, `shaders/`, `textures/`)
  - Font atlasing → `src/features/text/atlas/` (`FontAtlas`, `GlyphLayout`, `registerFont`)
  - Path tessellation → `src/features/paths/tessellate/` (`tessellate`, `polyline`, `stroke`)
  - Font assets → `assets/fonts/inter/`
- **`RenderLayer` interface simplified** to a single required `draw(view, ...): DrawCommand[]`. The 2D `draw(ctx, ...)` and GL-suffixed `drawGL(...)` are gone.
- **Pair renames** for the same reason: `SceneSlotConfig.drawOneGL` → `drawOne`, `*Tool.drawGhostGL` → `drawGhost`, `createChildrenLayer.drawChildGL` → `drawChild`. The 2D originals are deleted.
- **`drawLayersGL` renamed to `drawLayers`** (Phase-B coda), and the 6 debug-overlay `emit*GL` helpers dropped their `GL` suffixes (file-private).
- **Deleted exports:** `applyPaint`, `applyStroke`, `renderFilledRegion`, `RenderFilledRegionOptions`, `setupCanvasDpr`, `useFixedPixelRatio`, `SetupCanvasDprOptions`, `LayerRenderer` (abstract base class), `traceToContext`, `dragGhost` (`createDragGhost`).
- **Pattern API rebuilt on `TextureHandle`.** `createTilePattern(opts)` now takes `{ size, draw }` (no `ctx`), renders the tile to an `OffscreenCanvas` internally, and returns a `TextureHandle | null` via `registerTexture`. Each built-in (`hatch`, `crosshatch`, `dots`, `chunks`) drops its `ctx` parameter and returns a `TextureHandle | null`. The `Paint` `'pattern'` variant's payload is now `TextureHandle` (not `CanvasPattern`).
- **`Paint`, `Stroke`, `Region`, `StrokeAlign`, `GradStop` types preserved.** They moved to `src/core/paint-types.ts` (the implementation file `paint.ts` is gone). Public surface re-exports are unchanged.
- **`PixelDensityDemo` retired.** Its only purpose was demonstrating the deleted DPR helpers.

### Build / tooling

- `tsup.config.ts` `patterns-builtin` entry restored (after the C3 deletion + port).
- `package.json` `./patterns-builtin` export block restored.
- Vite `publicDir` updated to `assets/fonts`.
- Dropped weasel-gl-specific scripts: `test:smoke:step1`, `gen:font`, `bundlesize:weasel-gl`.

### Migration notes (in-repo)

Demos and `apps/draw` were updated in this release. No external consumers exist. The TypeScript types and re-export paths above tell the whole story; no migration guide ships.

### Added

#### `<SelectionContextProvider>` (`@experimental`)

- Ambient context publishing the active selection (`readonly string[]`) and an optional parallel `kinds` array so non-canvas UI (palette, status bar) can render type-aware copy ("3 paths selected"). `SceneCanvas` auto-publishes; consumers can override per-id labels via a `describeKind?: (node) => string` prop.
- New exports: `SelectionContextProvider`, `useSelectionContext`, `usePublishSelection`, `SelectionContextValue`.

#### Command palette extracted to `@weasel-js/ui`

- The demo's `<CommandPalette>` is now part of `packages/ui/` (alongside `<PropertiesPanel>`). Hooks (`useActionsRegistry`, `useAction`, `evaluateEnabled`, `ActionDisabledReason`) stay in the kit.
- The palette renders a kind-aware header ("1 path selected", "3 objects selected", "No selection") when `<SelectionContextProvider>` is in scope.

#### WebGL2 backend (carried over from the 0.1.x soak)

These items shipped as the `@experimental` GL backend during Steps 1–9; in 0.2.0 they're the only backend.

- New workspace package `@weasel-js/gl` housing the GL2 renderer.
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

#### Rotated resize

- `useResize` operates in the leaf's local frame when the pose carries
  rotation. The drag delta is projected through `R(−θ)`, anchor math runs
  in local frame, and the diagonally opposite world-space corner is pinned.
  Bit-identical for unrotated leaves (rotation = 0 short-circuits to today's
  path).
- New `ROTATED_POSE_DESCRIPTOR: PoseDescriptor<RotatedPose>` for the standard
  rotated-rect case. `PoseDescriptor` gains optional `getRotation?(pose):
number` so consumer pose types can opt into the rotation-aware path.
- New `fixedCornerOf(bounds, anchor): {x, y}` helper exposed via the
  `/resize` subpath barrel.
- Hit-test rotates handle positions to match the overlay's drawn handles —
  pointer events on visible handles register correctly on rotated objects.
- Group resize with rotated children remains unsupported; dev-mode
  `console.warn` fires once per gesture when any leaf has rotation ≠ 0.
- New demo: `demo/demos/RotatedResizeMathDemo.tsx` — three-panel math
  explainer with two counterexample descriptors (no projection, no position
  correction) plus live anchor-invariant ledger captions.

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
