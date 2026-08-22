# Changelog

## 1.0.4

### Patch Changes

- da7c150: The solid batch stops re-sending index data a ring slot already holds, and
  `u_color` / `u_alpha` join the per-frame uniform cache.

  A run of rects has indices that are a pure function of the rect count, so a
  slot coming round to the same count already holds the right bytes. A mesh's
  indices are rebased onto the staged vertices and a respecified buffer keeps
  nothing, so both mark the slot as holding no pattern and the next flush writes.

  `u_color` and `u_alpha` were excluded from `UploadedUniforms` because several
  places wrote them directly. All of those now go through `setColorUniform` /
  `setAlphaUniform`, which makes the cache correct per program rather than
  dependent on knowing which caller uses which — the batch holds `u_color` at
  white forever and was re-sending it once per flush.

  Measured together on an M2 Max via ANGLE (`tests/perf/clip-cost.spec.ts`): a
  flush 5.39 -> 3.22 us, entering a clip 12.47 -> 9.53. Read the difference, not
  the absolutes — the same spec measured a 4.35 us flush earlier on a cooler
  machine, and only the two halves of one A/B are comparable.

- f7df982: Path booleans keep holes, and Bezier flattening terminates on degenerate input

  `pathToMultiPolygon` emitted every contour of a path as its own polygon.
  `polygon-clipping` unions the polygons of a MultiPolygon, so a donut lost its
  hole the moment it entered any boolean op — `pathUnion`, `pathIntersect`,
  `pathSubtract`, `pathExclude`, `pathDivide` and `pathCrop` all returned a
  filled disc. The path's `fillRule` was never read. Contours are now resolved
  into outer + hole rings by nesting depth, honoring both `nonzero` and
  `evenodd`, before the clipper sees them.

  Results of a boolean op on a path with holes change shape, so this can move
  pixels.

  `flattenCubic`, `flattenQuadratic` and their arc-length variants recursed
  forever on a non-finite control point and on a tolerance of `0`, `NaN`, or a
  negative number — the flatness test can never be satisfied, so a stroke or a
  hit-test on a path carrying a `NaN` coordinate blew the stack. Non-finite
  input now emits the segment endpoint and stops; a non-positive tolerance is
  floored at `1e-6`.

- 85be764: Fix four renderer bugs found in a review of `packages/core/src/renderer`.

  - A stroke carrying per-anchor `vertexColors` never set the stencil test
    before its draw. Inside a clipped group it ignored the clip and wrote clip
    bits of its own; drawn after a clipped group it was tested against a bit
    that had just been cleared and disappeared entirely.
  - `GroupState` was never reset between frames, so a frame that threw part-way
    down the tree (the max-7 clip nesting error, for one) left every enclosing
    group's transform, alpha and color matrix on the stack and shifted every
    later frame.
  - `dispose()` never deleted the pattern-fill program.
  - `GLTextureCache` applied a texture's wrap mode on first upload only, so a
    registered image used as both a clamped shader texture and a repeating
    pattern tile got whichever mode reached it first.

  Also: re-registering a custom shader program on a renderer now deletes the
  program it replaces instead of orphaning it.

- a3db906: Correctness pass over the tools, canvas, interactions and affordances layers.

  Fixed, each with a test: a UI-driven ongoing action (color/opacity pickers)
  committed a second time when `cancelAll` had already ended its handle; the
  `align.*` and `distribute.*` descriptors reported themselves permanently
  disabled, greying out every `<ActionBar>` entry; `reorder.backward`,
  `align.*`, `distribute.*` and `pathfinder.*` read deps they never declared in
  `requires`, which throws in dev builds and silently bypasses a consumer's
  history in production; `ActionsRegistry.begin` ignored `requires` and so never
  passed the paint actions their `applyOps`; `Canvas.hitTestExtras` handed
  registered layers `undefined` where `draw` gets live data, making
  `composeAffordanceLayer`'s hit-test throw; `<Canvas>` never disposed its GL
  renderer on unmount; `useTools` returned a stale registry when a tool was
  added after mount; an `actions` prop override deleted the default action it
  merged onto when the prop object was rebuilt; picking and marquee selected
  nodes on hidden layers; a throwing drop-zone `onDrop` stranded every later
  pointer drag; `snapBackOrDelete`'s `'snap-back'` policy left the node where it
  was dropped; a cancelled pen handle-drag left the anchor it placed; and anchor
  affordances on a second selected path routed their drag into the path actually
  being edited.

  Removed as unreachable: `useViewportTools`, `Canvas.previewBoundsExtra`,
  `marqueeDrawCommands`, `applyHitExistingGate`, and the `enableKeyboard` options
  on `useAlign` / `useDistribute`, which documented a registration those hooks do
  not perform — `useStandardActions` owns it. The public `InsertOverlayStyle`
  type `marqueeDrawCommands` carried is unchanged and still exported.

- 12303bc: The solid batch no longer rewrites one pair of GL buffers on every flush. It
  cycles a ring of buffer sets instead — 64 slot-sized ones, plus 4 growable ones
  for a flush too big for a slot — so a write lands that many draws behind the
  draw that read the same buffer. On an M2 Max via ANGLE a flush goes from ~54 us
  to ~4.4, which is the cost anything that breaks a run of solid geometry was
  paying: entering a clip is 64.9 us -> 10.2, and a boundary between solid and any
  other command kind is 28.4 us -> 2.5. Measured by `tests/perf/clip-cost.spec.ts`
  and `tests/perf/transition-matrix.spec.ts`.

  The driver tracks a write hazard per buffer object, so a flush that overwrote
  its buffers from offset 0 waited on the draw still reading them. Writing
  disjoint ranges of one buffer does not escape that — the hazard is per object,
  not per range.

  Nothing about the API or the pixels changes. Buffers are taken on first use
  rather than at construction, so a renderer that never draws solid geometry
  allocates none, and every set is freed in `WeaselRenderer.dispose`.

- d36953e: SVG import and export lose less on the way through, and installed fonts pick
  one face per variant slot.

  Paint servers are now found wherever they are declared, not just as direct
  children of `<defs>`, and a gradient that inherits another's stops or geometry
  through `href` / `xlink:href` resolves instead of coming back empty.
  Percentages are read as ratios, so `x2="100%"` no longer means 100 bounds
  units, and `gradientTransform` warns rather than silently painting elsewhere.

  Three fidelity bugs in the round trip itself. A leaf's own `transform` was
  decomposed against bounds that had already been through the inherited matrix,
  so a rotation inside a translated `<g>` lost its rotation and moved. Any
  stroke carrying `stroke-opacity` re-serialized with the attribute written
  twice, which is not well-formed XML. And the computed `viewBox` was taken from
  unrotated, untransformed geometry, cropping rotated content out of the export.

  `<text>` now follows SVG's whitespace rules, so importing a pretty-printed
  file no longer drags the source indentation into the document text; weasel's
  own `<text>` carries `xml:space="preserve"` to keep real line breaks. A nested
  `<svg x= y=>` places its children at that origin.

  In the shared `d=` grammar, exponent coordinates (`M1e2 1e2`) no longer read
  the `e` as a command, and arc flags written without separators
  (`A5 5 0 0110 0`) no longer drop the arc.

  `enableLocalFontOutlines` picks the least-qualified face when several installed
  faces reduce to one (weight, style) slot, so "Helvetica Neue Condensed Bold"
  stops displacing "Helvetica Neue Bold" depending on query order.

  **Exported SVG bytes change**: `<text>` gains `xml:space="preserve"`, a stroke
  writes `stroke-opacity` once, and a document containing rotated or
  group-transformed content gets a larger computed `viewBox`.

- Updated dependencies [bd42540]
- Updated dependencies [d36953e]
  - @weasel-js/geom@1.0.4
  - @weasel-js/history@1.0.4
  - @weasel-js/gestures@1.0.4
  - @weasel-js/font@1.0.4
  - @weasel-js/modes@1.0.4

## 1.0.3

### Patch Changes

- 5d25a40: `@weasel-js/font`'s six reset seams — `_resetFontRegistryForTests`,
  `_resetFallbackForTests`, `_getPagesForTests`, `_resetDynamicFontsForTests`,
  `__setGlyphRasterizerForTests` and `_resetFontOutlinesForTests` — are no longer
  exported from the package barrel. They now live at a new
  `@weasel-js/font/test-seams` entry point.

  Nothing loses the ability to reach them. They exist because font registration,
  the fallback policy, the dynamic atlas and the outline registry are global
  module state that changes what renders, so a test in another package that sets
  one has to be able to put it back — which is why they were on the barrel in the
  first place. A named test-seam entry serves that need without an application
  finding a `_resetFontOutlinesForTests` by autocompleting the barrel. Both
  entries share one chunk, so the registries remain single instances.

  This is a breaking change for anything importing those six names from
  `@weasel-js/font`; the import specifier is the only edit.

  `evaluateEnabled` in `@weasel-js/core` is now marked `@experimental` at its
  definition. An `@internal` block intended for it had come detached and sat above
  three unrelated constants, so the function read as undocumented public API while
  a stale marker said otherwise. It is genuinely public — `@weasel-js/ui`'s
  `ActionBar` calls it — and `@experimental` matches the rest of the `enabled`
  predicate surface.

- f7077f6: An image quad no longer mints and frees a vertex array and two buffers on every
  draw. The renderer keeps a ring of quad geometry per image program instead, and
  a draw writes its four corners into the next slot. On an M2 Max via ANGLE this
  takes an image command from ~7.0 us to ~3.9 us, measured by
  `tests/perf/image-quad.spec.ts`; nothing about the API or the pixels changes.

  A ring rather than one buffer, because one is the worst of the three shapes. The
  driver tracks a write hazard per buffer object, so rewriting a single quad
  buffer before each draw waits on the draw still reading it — 40–80 us per quad
  against 5.4 for the per-draw allocation this replaced and 0.3 for the ring.
  Sixty-four slots put that many draws between one write of a buffer and the next.

  The remaining gap to a pattern-filled rect of the same size (~2.3 us) is texture
  state, not geometry: an image binds a different texture and sets its filter per
  draw.

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

- Updated dependencies [5d25a40]
- Updated dependencies [514c34a]
  - @weasel-js/font@1.0.3
  - @weasel-js/geom@1.0.3
  - @weasel-js/gestures@1.0.3
  - @weasel-js/history@1.0.3
  - @weasel-js/modes@1.0.3

## 1.0.2

### Patch Changes

- 28710f2: The renderer's solid batch is drained at the sites that decide routing or
  change stencil state, instead of at each emitter that happened to remember.
  Geometry that cannot join a run now goes through `tryStageSolid`, which returns
  `false` only after flushing — so the only way an emitter earns permission to
  draw for itself is to have called the function that drained the batch. `pushClip`
  and `popClip` flush as their first statement, since rasterizing into the stencil
  is what creates the obligation.

  Nothing about the drawn result changes; this removes a way for a future draw
  path to paint under geometry staged before it.

- 2e3fea2: The `routing` namespace is gone from the main barrel, and the reflection
  surface exports only what a consumer can use.

  `export * as routing` made tool authoring reachable two ways — `core.routing.defineTool`
  and the `@weasel-js/core/routing` subpath — and no consumer ever used the first.
  It survived as the unfinished half of the 2026-05-12 declarative-routing work,
  whose Phase 6 was to move `defineTool` out of `routing/` entirely. **Removing
  it is a breaking change for anyone importing the namespace form**; the subpath
  is unchanged and is what every known consumer already uses.

  `tools/routing/reflection` now exports `buildRouteRegistry`, `findConflicts`,
  `RegistryEntry` and `Conflict` — the four an external inspector needs.
  `PREDICATE_TARGET`, `findScopedConflicts`, `formatConflict`,
  `reportRouteConflicts` and `ToolScopes` are still there and still used; they
  are just no longer public, since their only caller is inside the kit.

- 75ba7b1: Three fixes found by re-checking backlog entries against the code.

  SVG gradients survive a round trip. The parser now reads `gradientUnits`
  (`objectBoundingBox` → `units: 'bounds'`, `userSpaceOnUse` → `'world'`) and the
  serializer writes back whichever the paint declares, instead of hardcoding
  `userSpaceOnUse` on the way out — which had been reading a box-relative
  gradient's `0..1` geometry as page coordinates, i.e. a gradient the size of a
  pixel.

  `unpackSvgFiles` keeps gradient fills instead of flattening them to a solid.
  The reason recorded for the flattening — that the `kit:path` painter has no
  gradient slot — had not been true for some time; `NodeFill` is
  `string | FillStyle`, now exported. A `userSpaceOnUse` gradient is normalized
  against the leaf's own box on the way in, so it survives the fit-clamp and
  drop-point placement that move the geometry out from under it. Gradient
  _strokes_ still flatten: `data.stroke` genuinely is a color string.

  `extractUniformNames` skips precision and interpolation qualifiers. `uniform
highp float u_t;` — the common spelling in hand-written GLSL — matched nothing
  at all, so the uniform got no location and every write to it was dropped in
  silence. Comma-separated declarator lists (`uniform float a, b;`) read too.

  Also adds `tests/visual/text-decoration.spec.ts`, a baseline-free assertion
  that underline and strikethrough sit `0.40 em` apart and span only their own
  runs. It measures the gap between two gap-free horizontal ink runs, which is
  something `text.spec.ts`'s 5% diff tolerance cannot see move.

- e4a6ec4: Tool authoring moved out of `routing/` and onto the main barrel. `defineTool`,
  `defineViewportTool`, `ToolDef`, `ViewportToolDef` and `ToolKeybinding` now come
  from `@weasel-js/core`:

  ```ts
  import { defineTool, type ToolDef } from "@weasel-js/core";
  ```

  **This is a breaking change for anyone importing them from
  `@weasel-js/core/routing`.** That subpath keeps the route grammar (`parseRoute`,
  `formatRoute`, `describeRoute`, the gesture descriptors) and the reflection
  consumers (`buildRouteRegistry`, `findConflicts`) — it is now only the surface
  that _reads_ routes back, matching its name.

  Finishes Phase 6 of the 2026-05-12 declarative-routing work. Source layout
  follows: the factory and its `ToolDef` types sit at the top of `src/tools/`
  alongside `useTools` and `useKeybindings`, with `routing/types.ts` renamed
  `routeTypes.ts` to clear the existing `tools/types.ts`. Behavior and runtime
  contract are unchanged.

- d2a9049: Six backlog entries, all in the input and hit-test layers.

  Tool overlays can say where they sit. `Contribution.overlay` takes a
  `RenderLayer` or an array of them, and a new `overlayPosition` (`'top'` — the
  default — / `'before-selection'` / `'after-selection'`) anchors them against
  the selection chrome instead of always landing on top; with no selection layer
  in the stack the anchored positions fall back to the tail.
  `getActiveOverlays(position?)` partitions, and `placeToolOverlays` in
  `canvas/layerOrder.ts` does the splice, so the ordering is testable without a
  GL context.

  `drop` and `paste` are route-grammar gesture names. They shipped without them,
  so the inspector reported `undefined` for every ingestion binding. Both are
  targetless and carry the spec's MIME-glob filter as their arg — `drop(image/*)`.

  An unhandled paste stays the page's. `onPaste` now dispatches first and calls
  `preventDefault` only on `'handled'`, the shape `onWheel` already used.
  Clipboard items materialize synchronously, so unlike `onDrop` the result is
  known while the default can still be suppressed.

  Marquee and lasso see the shape a node actually draws. `hitTestArea` asked the
  _pose_ for a silhouette, which meant the kit's own inserted shapes — geometry
  on `node.data.path` behind a plain `{x,y,w,h}` pose — took the AABB path and
  kept every false positive the silhouette test exists to drop. It now asks
  `findShapeSilhouette` for the drawn world-frame boundary. Paying for that is a
  containment short-circuit: a node the rect marquee swallows whole is a hit no
  silhouette can overturn, so neither the kernel nor the painter runs. Net
  against the committed bench baseline, polygon-pose scenes gain (1.25x at 1000
  nodes / 100% area) and plain-rect scenes lose ~8% on the two rows that scan
  everything. The short-circuit is marquee-only, behind `hitTestAreaPolygon`'s
  `areaIsRect` flag, because a node inside a lasso hull's bounding box can still
  miss the hull.

  Layout siblings reflowing mid-drag render opaque. `OngoingHandle.previewOpaqueIds()`
  names the subset of `previewIds()` that skips the ghost alpha; `moveAction`
  fills it from the destination and source reflow ids. A ghost means "in flight
  under the pointer", which a sibling settling into its destination slot is not.

  `LayoutStrategy.acceptsDrop(container, dragged)` rejects a drag before any
  drop-target work, so a type-aware container falls through to whatever sits
  under it rather than swallowing everything in its bounds.

  `flipAction` reads `params.pivot`. `'each'` (the default, unchanged) mirrors
  every pose about its own AABB; `'union'` mirrors about the selection envelope
  so items swap sides, and the `geometryProjection` data op follows the same
  pivot.

- 5f05431: `viewport.pinchZoom` now pans as well as zooms. It anchored `zoomAt` on the
  current gesture centroid and never translated by the centroid delta, so two
  fingers travelling together — spread unchanged, zoom factor 1 — moved the view
  not at all.

  Each frame now anchors the zoom on the previous centroid and then translates by
  how far the centroid travelled. Together those pin the world point under the
  gesture midpoint as the midpoint moves, which is what makes a pinch feel
  attached to the fingers.

  The action's id and label are unchanged (`viewport.pinchZoom` / `Pinch Zoom`).
  Consumers who bound it get panning with no wiring change.

- 5fea43d: Five unrelated small fixes.

  A tapered stroke with `align: 'inner'` or `'outer'` on a polygon path painted
  at half its requested widths. That alignment renders by tessellating at twice
  the width and stencilling half away, and the doubling reached `stroke.width`
  but not `vertexWidths`. The doubled array is memoized per source array, since
  the ribbon cache compares it by reference.

  An image insert previews the decoded bitmap inside the drag bounds instead of
  committing on release with no preview at all. It falls back to the bare
  outline until the image decodes, and `useImageTool({ preview: 'outline' })`
  opts out of the bitmap entirely.

  A HUD widget that claims the pointer reports a `'pointer'` cursor without
  implementing anything — hovering one while a drawing tool was active used to
  keep showing that tool's cursor. The rule is keyed on the `claims` every
  widget already declares, so it covers consumer-authored widgets too;
  decoration claims nothing and the hit walk descends past it. A widget's own
  `cursorAt` still wins, and `button` takes a `cursor` option that feeds it.

  `composeAffordanceLayer`'s `hitTest` returns a `LayerHit`, carrying the hit
  region's declared cursor and claim instead of dropping them. `AffordanceRegion`
  gains optional `strength` / `claimedKinds` to declare that claim.

  `ToolPalette` uses the shared `useRovingTabIndex` rather than its own container
  handler, so arrow keys skip tools that are ineligible in the current mode and
  the tab stop no longer sits on one. `ToolButton` takes an `onKeyDown`.

- 443d74e: Stroke ribbons are tessellated once per stroke configuration instead of once
  per frame. The renderer rebuilt every stroked path's ribbon geometry on every
  frame and discarded it; it now caches the result on `Path` identity, keyed by
  the parameters that change the ribbon — width, cap, join, miter limit,
  alignment, dash, and flatten tolerance. Paint and vertex colors are not in the
  key, since both are applied over the same triangles at draw time.

  A ribbon that survives a frame also stops paying for a fresh VAO and two
  buffers on every subsequent frame. One whose path or stroke parameters change
  each frame keeps the transient upload it had before, freed at end of frame —
  so an animated or freshly drawn path never accumulates GL resources waiting on
  garbage collection.

  Nothing about the drawn result changes. The cache is keyed on object identity,
  matching the fill cache: a `Path` rebuilt with equal coordinates is a distinct
  entry and re-tessellates.

- 7decec1: Four more backlog fixes.

  `@weasel-js/svg` reads and writes `<image>`. A new `SvgImageNode` holds the
  `href` verbatim — an external URL or a `data:` URI, with `xlink:href` accepted
  on the way in — plus a box that inherited transforms collapse onto and an
  element-local rotation. `unpackSvgFiles` maps it onto the `kit:image` painter's
  `data.image.src`, so a dropped SVG carrying raster content now keeps it instead
  of dropping the element on parse. `preserveAspectRatio` is not modeled: the box
  is taken literally and written back as `none`, and a non-`none` source warns.

  `pickTopMostHit` resolves sibling z-order. An adapter can supply `getZIndex(id)`
  or `compareZ(a, b)`; both compose with the existing parent/child collapse rather
  than replacing it, so a child still beats its own ancestor whatever z the two
  report. Without either, the hit list's own order decides, as before.

  `useSceneTextEdit` supplies `setStyle`. Clearing a style flag that the _node_
  sets is the one edit the additive run algebra can't express, and `useTextEdit`
  declines it without a writer — so every scene-wired consumer silently refused
  that toggle. Override the projection with `setStyle(data, style)` for a
  non-default data shape.

  The slops debug overlay draws handle halos at the real hit radius. Affordance
  regions moved to screen-pixel radii, but this layer still scaled its circles by
  the view, so at 4x zoom it drew a 32px halo over an 8px target — the one thing
  a hit-test overlay must not do. Anchor slops now read the anchor radius rather
  than the handle radius.

- 24daa08: Five unrelated backlog fixes.

  The specificity tuple's `phase` dimension is graded rather than binary: an
  atom scores 2 when both its channel and its lifecycle state are concrete, 1
  when one axis is wildcarded, and 0 for `*:*`, which matches everything an
  undeclared phase would have matched. An atom list takes the minimum, since
  `matchPhase` is a union. No existing binding reorders — the four ambient
  actions hold at 1, and the polygon and star tools' `phase: 'engaged'` wheel
  bindings rise to 2, widening a gap they already won.

  The loupe's pixel mode no longer drops the end of a fast drag: a readback
  requested while `createImageBitmap` is in flight is remembered and re-run when
  that one settles, instead of being discarded.

  SVG unpack applies the fit-clamp to text on both axes. `fontSize` now scales
  with the file, and a text node's box width is estimated from its longest line
  instead of inheriting the parser's unbounded-width wrap sentinel — which,
  folded into the union AABB, had been clamping any external SVG containing
  text down to a speck. That sentinel is now the exported `UNBOUNDED_TEXT_WIDTH`
  rather than a bare `99999`, so a consumer reading `SvgTextNode.width` can tell
  a measurement from a placeholder.

  The debug overlay takes per-feature line widths and dashes through
  `DebugConfig.strokes`, alongside the colors `DebugConfig.theme` already
  carried. Defaults are unchanged.

  A `.dfont` face declines the outline tier by name. Datafork TrueType holds its
  sfnt tables inside a Macintosh resource map, which is still not unpacked, but
  it is now recognized before parsing and reported as itself rather than dying
  on an unrecognized-signature message that never says which format it saw.

- f79e4b2: Viewport layers can now answer where a screen point lands inside them.
  `createViewportLayer` returns a `ViewportLayer`, adding:

  ```ts
  layer.reproject(outer, dims, screen); // → inner-world point, or null if outside
  viewportsAt(layers, outer, dims, screen); // → topmost viewport containing it
  ```

  `bounds` is already a pure function of `(outer, dims)`, so re-projection
  recomputes the exact rect the frame painted rather than a remembered one — no
  stored state and nothing to go stale. Right and bottom edges are exclusive, so
  adjacent viewports never both claim a pixel.

  This deliberately does **not** touch the dispatcher, which the previous
  docstring promised it would. Tools still target the outer view; a consumer that
  wants a click inside a viewport to mean something calls `reproject` from its own
  handler. Making tools work _inside_ a viewport raises questions this primitive
  does not answer — which view a pinch zooms, what a drag leaving the rect does —
  and is tracked as its own item.

- Updated dependencies [d2a9049]
- Updated dependencies [24daa08]
  - @weasel-js/gestures@1.0.2
  - @weasel-js/font@1.0.2
  - @weasel-js/geom@1.0.2
  - @weasel-js/history@1.0.2
  - @weasel-js/modes@1.0.2

## 1.0.1

### Patch Changes

- d6c2eff: Take the id→node lookup off the render and hit-test paths.

  Six call sites walked `scene.renderOrder()` and immediately resolved each id
  back through `scene.get` — a map lookup per node, per call, for nodes the
  traversal had already held. They now read `scene.renderOrderNodes()` directly:
  `sceneToAdapter.getNodes`, the move gesture adapter and the default commit
  adapter, `useSceneSelectTool`'s `hitTestArea` and default `pickEvery`, and the
  text-edit hit test. Adapter `getNodes` runs on the render path once a frame.

  Building the node list is about twice as fast (`npm run bench`, `min`, Apple M2
  Max / Node v26.1.0):

  | nodes  | via `renderOrder` + `get` | via `renderOrderNodes` |
  | ------ | ------------------------- | ---------------------- |
  | 1,000  | 0.031 ms                  | 0.011 ms               |
  | 10,000 | 0.40 ms                   | 0.19 ms                |

  `tests/bench/scene-ops.bench.ts` gains that comparison, and the committed
  baseline is re-recorded.

- d62dc17: Bake the rect batch's transform and alpha into its vertices, so a rotated or
  partly-transparent node no longer breaks a run.

  `RectBatch.push` now maps the four corners through the model matrix itself and
  the flush draws at `u_model` identity — ~12 flops against the ~66 us a draw call
  costs. An affine maps a rect to a parallelogram, so the two-triangle index
  pattern still covers it. Group alpha multiplies into the vertex alpha the same
  way fill opacity already did. Neither is batch state any more.

  Frame cost for rects each wrapped in their own transform group — what
  `wrapNodeOutput` emits for a rotated node — M2 Max via ANGLE at 800x600
  (`npm run test:perf`, new `rotated` variant):

  | rects | before    | after   |
  | ----- | --------- | ------- |
  | 400   | 24.94 ms  | 0.08 ms |
  | 1,600 | 102.78 ms | 0.42 ms |
  | 3,200 | 216.90 ms | 0.52 ms |

  The color matrix stays a uniform and stays a barrier. The shader applies it and
  its clamp to the straight-alpha source _before_ multiplying by `u_alpha`, so a
  pre-multiplied vertex alpha is the same number only under an identity matrix —
  which is every scene that does not use one. Alpha therefore folds only there,
  and rides `u_alpha` otherwise.

- 2604ce2: Merge consecutive solid-fill rects into one draw call.

  The draw loop cost a flat ~66 us per draw call at every scene size, so a frame
  of 3,200 rects took 212 ms. Solid-fill rects now append into a growable vertex
  buffer and go out as a single `drawElements` at flush. Fill color rides the
  vertices — the batch draws through the existing `pathFillVColor` program with
  `u_color` held at white, which is bit-identical to the flat program's math.

  Frame cost for a **flat** command stream, M2 Max via ANGLE at 800x600
  (`npm run test:perf`):

  | rects | before    | after   |
  | ----- | --------- | ------- |
  | 400   | 25.62 ms  | 0.03 ms |
  | 1,600 | 105.63 ms | 0.11 ms |
  | 3,200 | 211.78 ms | 0.15 ms |

  Painter's order is unchanged. A run absorbs only consecutive commands and
  flushes before anything it cannot express: another fill kind, a stroke, a clip
  push or pop, or a group changing the transform, alpha, or color matrix.

  That last barrier means `SceneCanvas` does not benefit yet — it emits one
  wrapper group per node, which breaks every run. Consumers building flat command
  streams get the numbers above today. See
  `docs/handoffs/2026-08-14-batched-dispatch.md` for the plan to reach the scene
  path. Nothing else in the loop got faster either: a frame alternating solid and
  gradient rects still costs ~34 us per command, now almost entirely the gradient
  half.

- 24ae9f4: Batch solid-fill meshes and stroke ribbons alongside rects, so a stroked shape
  costs one draw instead of two plus a fresh VAO every frame.

  `RectBatch` becomes `SolidBatch`, with a `pushMesh` alongside `pushRect` that
  appends transformed vertices and rebases the mesh's indices onto the staged run.
  Solid path fills and solid stroke ribbons both take it, and land in the same
  draw as each other: GL rasterizes a draw's primitives in index order, so staging
  the ribbon after its own fill is what keeps the stroke on top.

  Frame cost at 3,200 commands, M2 Max via ANGLE at 800x600 (`npm run test:perf`,
  new `meshes` and `stroked` variants):

  | variant                       | before    | after   |
  | ----------------------------- | --------- | ------- |
  | solid-fill octagons           | 5.63 ms   | 0.65 ms |
  | stroked rects (fill + ribbon) | 243.80 ms | 9.41 ms |

  The stroke figure is the interesting one, and not for the reason the plan
  assumed. A draw call is ~1.8 us when nothing is touched between draws; what
  costs is issuing a draw against a buffer minted that same frame, which is
  exactly what a per-frame stroke ribbon did. Of the 9.41 ms left, 7.9 ms is
  stroke tessellation, which batching does not address.

  Excluded from a run: stencil fills, inner/outer-aligned polygon strokes, and
  anything carrying per-vertex colors, all as before — plus meshes past a vertex
  cap, since batching re-copies a mesh every frame where the persistent mesh cache
  would not. Rects pay ~0.1 ms per frame at 3,200 for the index buffer becoming a
  per-flush upload rather than a static pattern.

- c2ebfdf: Break rect batches on group state rather than on tree shape, so `SceneCanvas`
  gets the batching.

  A group was a batch barrier because it _might_ move a uniform. `buildSceneTree`
  gives every node its own group with no transform, alpha, colorMatrix or clip, so
  in the scene shape every run broke after one rect and the previous release's
  batching reached nothing the app renders. A run now carries the state it was
  staged under and breaks only when the live state differs by value — which a
  no-op wrapper never does.

  Scene-shaped frame cost, M2 Max via ANGLE at 800x600 (`npm run test:perf`, new
  `scene` variant — one wrapper group per command):

  | rects | before    | after   |
  | ----- | --------- | ------- |
  | 400   | 26.32 ms  | 0.03 ms |
  | 1,600 | 105.18 ms | 0.11 ms |
  | 3,200 | 208.72 ms | 0.36 ms |

  Clips stay hard flush points in both directions: the stencil is GL state that a
  staged run cannot reconstruct, so the flush happens before `pushClip` and before
  `popClip` rather than at group boundaries. Text, images, shaders, strokes and
  non-solid fills flush as before.

- dce3306: Cache `renderOrder()` and `renderOrderNodes()` between structural edits.

  Both walk the whole tree, and both run per frame and per hit-test query, on a
  sequence that only changes when something structural moves. They now build once
  and are served from a cache until it does. On a 10,000-node, four-layer scene a
  repeat call drains in 0.0033 ms against a 0.33 ms rebuild (`npm run bench`,
  `min`).

  Invalidation hangs off the four writers that can reorder the scene — `attach`,
  `detach`, `kit:setLayer`, `rebuildLayerIndex` — plus `loadState`. Pose and data
  edits do **not** invalidate: they change no order and fire every frame during a
  drag, which is exactly when the cache earns its keep.

  Repeat calls now return the same array instance rather than a fresh one. It is
  still a snapshot — a structural edit builds a new array, so a reference taken
  earlier keeps the order it was taken with — but callers must not mutate what
  they get back. Both return types have always been `readonly`.

- 69395b0: Detached scene renders honor pose rotation and per-node alpha.

  Rotation and the per-id alpha multiplier were applied by `buildSceneLayer`,
  the main canvas's scene walk. Every other way of painting a scene —
  `<SceneViewCanvas>`, `<MinimapCanvas>`, and `renderSceneToPixels` — goes
  through `buildSceneViewCommands` instead, which applied neither. A rotated
  node came out upright in a minimap, a thumbnail, or a print export, and a
  scene dimmed on screen exported at full strength.

  Both wraps now live in one helper that both scene walks call, so the detached
  renders match the canvas. Rotation needs nothing from the caller — it comes
  off the pose. Dimming does: `alphaFor` is a new optional prop on
  `<SceneViewCanvas>` and `<MinimapCanvas>`, and a new argument to
  `renderSceneToCanvas`, `renderSceneToPixels`, `planPixelRender`, and
  `buildSceneViewCommands`. Pass the same function `<SceneCanvas>` gets.

  If you supply a `drawOne` to one of these that rotates its own output, it will
  now rotate twice — emit unrotated geometry and let the pose drive it, which is
  what the main canvas has always required.

- 3d93f2e: Detached scene renders now honor layer visibility and container clips.

  `buildSceneViewCommands` walked `scene.renderOrder()` and painted every node it
  found. That walk knew nothing about scene layers or parentage, so
  `<SceneViewCanvas>`, `<MinimapCanvas>` and `renderSceneToPixels` all painted
  nodes on hidden layers and let a container's children spill past the container.
  The main canvas got both right, because `buildSceneLayer` goes through
  `buildSceneTree`.

  The detached path now goes through `buildSceneTree` too, which is the dedupe the
  detached-minimap spec called for. One walk, so the two surfaces cannot disagree
  again.

  Output nesting follows `buildSceneTree`: the view group holds one group per
  **visible** scene layer, each holding one group per node. Code that indexed the
  view group's children as one-per-node — `commands[0].children[i]` — now finds a
  layer group there and needs a further hop. `extraCommands` still come last,
  beside the layer groups.

  A hand-written `Scene` stand-in must now supply `layers`, `roots`, and
  `children` on containers; scenes from `createScene` and `sceneFromJSON` already
  do.

- e367165: One enumeration of the `TargetSpec` forms. `@weasel-js/gestures` now exports
  `parseTargetSpec`, which resolves a target spec to a discriminated
  `TargetSpecForm` (`body` / `kind` / `affordance` / `predicate`), and the three
  places that used to re-derive the string prefixes independently — `matchTarget`,
  and `targetRank` / `targetConsultsAffordance` in core's dispatcher matcher —
  switch on it exhaustively. Adding a form to `TargetSpec` is now a compile error
  at every site that has to handle it.

  For consumers: `matchTarget`'s `specTarget` parameter and core's
  `targetConsultsAffordance` take `TargetSpec | undefined` instead of `unknown`,
  so a target string that is no known form is a type error rather than a silent
  no-match. The predicate form has a name, `TargetPredicate`, carrying the
  `readsAffordance` flag the exclusive-claim filter reads. Runtime behavior is
  unchanged.

- 52e9c57: Walk the scene once in `renderOrder()` instead of once per layer.

  The generator behind `renderOrder()` and `toJSON()` was layer-major in the
  literal sense: it ran a full DFS of the tree for every layer and yielded only
  the nodes belonging to that pass, so producing N ids cost L×N work. A single
  DFS now buckets each node by its layer and concatenates the buckets, which is
  O(N + L). The emitted sequence is unchanged — same layer-major order, same
  DFS-preorder within each layer, same skip for dangling child ids — and a
  differential test holds the new implementation to a transcription of the old
  one across 200 generated scenes plus mutation, layer-edit and undo sequences.

  Over 10k nodes the layer sweep goes from 0.37 ms / 1.03 ms / 3.54 ms / 12.93 ms
  at 1 / 4 / 16 / 64 layers to 0.30 / 0.35 / 0.40 / 0.42. The flat single-layer
  case improves too, 0.37 ms → 0.33 ms at 10k nodes and 2.1x at 100 nodes, since
  one pass replaces the per-yield generator overhead.

  `renderOrder()` now returns an array rather than a generator, so a caller that
  stops early no longer avoids the rest of the walk. Every caller in the repo
  drains it fully except four test helpers reading the first id from a handful of
  nodes. Its declared type stays `Iterable<NodeId>`.

- d68e734: Memoize the per-node AABB in the area hit-test, for silhouette poses.

  `hitTestArea` — the marquee and lasso dep source — recomputed every node's
  bounding box on every query. For a polygon pose that means walking the whole
  command stream and allocating a rect, per node, before the fast-reject could
  discard it. The box is now cached through `nodeMemo`, keyed on the node's
  `pose` and `data` references, so a repeat query over an unedited scene reuses
  it and an edit through any scene op invalidates it.

  Measured on 24-gon scenes (`npm run bench`, `min` column, same machine
  back-to-back): 10,000 nodes 11.85 ms → 1.16 ms per query, 1,000 nodes
  1.14 ms → 0.15 ms. Query-rect size now moves the number (0.117 ms at 17 hits
  against 0.141 ms at 1,000 hits on a 1,000-node scene, previously flat at
  ~1.15 ms either way) because the silhouette kernel, not the bounds
  computation, is what survives the reject.

  Rect-pose scenes pay 5–17% for it: `aabbOfPose` returns a rect pose
  unchanged, so there is nothing to cache, and deciding that per node costs
  more than the call it skips. 10,000 rect nodes go 0.76 ms → 0.85 ms.

- ca9673a: Stop re-sending unchanged uniforms on every draw command.

  `u_proj` is constant for a whole frame and `u_colorMatrix` is the identity in
  every scene that does not use a color matrix, yet both were uploaded for every
  command — along with a fresh `Float32Array(16)` and a transpose per draw to
  build the color matrix, and a fresh `screenToClip` matrix per draw to build the
  projection. GL holds uniform state per program object, so all of that was
  buying nothing.

  `draw.ts` now remembers what it last sent each program and skips the upload
  when the value has not changed. On a frame of 1,000 solid rects that takes
  `uniformMatrix4fv` from 1,000 calls to 1 and `uniformMatrix3fv` from 2,000 to
  2, and removes two per-draw allocations.

  The cache hangs off the `DrawContext`, which is rebuilt per frame, so it cannot
  outlive a frame or go stale against GL state changed between frames. It covers
  only the four uniforms this module is the sole writer of — `u_color` and
  `u_alpha` have several writers and are still sent every draw.

  This does not measurably change frame time on an M2 Max: the draw loop is bound
  by per-draw-call cost (~68 us per command), not by uniform uploads. It removes
  the calls and the allocations; `docs/TODO.md` tracks what the remaining cost
  actually is.

- fa1ed05: Dragging a text node no longer re-lays it out.

  `layoutRuns` baked the text's position into every quad, decoration rule and
  line box, so `layoutCache` had to carry that position in its key. Panning and
  zooming still hit the cache, but _moving_ a text node missed on every frame —
  at 500 wrapped glyphs a move cost 0.130 ms against a 1.7e-4 ms hit, which is
  the same 0.134 ms a full miss cost. Moving text paid as if there were no cache
  at all.

  Layout now emits geometry relative to the text's own top-left and `drawText`
  translates while packing vertices, alongside the `verticalAlign` offset it
  already applied there. Position is out of the cache key, so a move is a hit:
  median 0.130 ms → 0.000125 ms, min 0.123 ms → 0.000041 ms. The cold path is
  unchanged (min 0.123 ms → 0.110 ms for a full miss).

  This is not a rendering change. Alignment, wrapping, tracking, kerning and
  decoration placement read widths and pen deltas, never an absolute coordinate,
  and nothing in the walk rounds or snaps — checked over 247,572 coordinates
  spanning three alignments, four wrap widths, mixed sizes, positive and negative
  tracking, and fractional positions. The only differences were float64 rounding
  from folding the position into the accumulator early, none of them survived the
  conversion to the float32 vertex buffers, and they favor the new code: at a
  position of 1e6 the old path computed 28.800000000046566 where this one gives
  28.8. The 37-test Playwright visual suite is unchanged.

  `layoutRuns` and `cachedLayoutRuns` lose their `origin` parameter, and the
  `LayoutRunsOrigin` type is gone. Neither is exported from the package. Callers
  of the public `textLineBoxes` and `measureTextBounds` see no change.

- 0a40c29: Add `scene.renderOrderNodes()`, and scan it in the area hit-test.

  `renderOrder()` hands back ids, and almost every caller immediately resolves
  each one back to a node — a map lookup per node, per query, for a node the
  traversal had in hand and dropped. `renderOrderNodes()` is the same
  layer-major sequence as the nodes themselves. It is a snapshot, freshly built
  per call, exactly like `renderOrder()`.

  `hitTestArea` (marquee and lasso) now scans it, and reads `pose.kind` inline
  instead of through the `isPathLike` predicate. Together those recover the
  5–17% the AABB memo cost rect scenes and take a good deal more besides
  (`npm run bench`, `min` column, three alternating runs per build on one
  machine; run-to-run scatter on these was under 3%):

  | 10,000 nodes, 25% query rect | before  | after   |
  | ---------------------------- | ------- | ------- |
  | rect poses                   | 0.94 ms | 0.53 ms |
  | 24-gon silhouettes           | 1.21 ms | 0.78 ms |

  `renderOrder()` itself gets a separate walk for the single-layer case, which
  needs no per-layer buckets and can compare the layer id rather than index it:
  10,000 nodes over one layer 0.27 ms → 0.19 ms, with multi-layer scenes
  unchanged. `toJSON()` rides the nodes walk and skips its lookups too.

  `Scene` gains a method, so a hand-written stand-in for a scene needs to
  implement it; scenes from `createScene` and `sceneFromJSON` already do.

- Updated dependencies [e367165]
  - @weasel-js/gestures@1.0.1
  - @weasel-js/font@1.0.1
  - @weasel-js/geom@1.0.1
  - @weasel-js/history@1.0.1
  - @weasel-js/modes@1.0.1

## 1.0.0

### Minor Changes

- ffd9713: Chrome hit-tests are axis-aware under non-uniform zoom.

  Chrome declares its hit zones in screen pixels and paints in screen space, but
  the hit-test converted those pixels to world units through `meanScale`, a
  single geometric mean of the two axis scales. Under per-axis zoom that made the
  pickable region larger than the painted one on the squashed axis and smaller on
  the stretched one — an 8px handle at `scale: { x: 4, y: 1 }` was grabbable 16
  screen px to the side and only 4 px above.

  New primitives in `core/viewport/pxExtent`, all exported: `pxExtent(px, scale)`
  for a per-axis world length, and `withinPxBox` / `withinPxRadius` to compare a
  world-space delta in screen space directly, which can't drift from the paint at
  all.

  `AffordanceRegion`'s `point` hit is now that screen-space comparison, so a
  handle's hit region is the square you see — which also fixes it under a rotated
  target, where the old local-frame test was a tilted rectangle on screen. The
  annulus band floor (`minBandPx`) and the annulus paint inset (`insetPx`) are
  per-axis, keeping the ring you can see the ring you can grab. The pen's
  close-hit radius is a screen-space circle. Snap-guide tolerances — the shared
  guide strategy, insert, resize, and alignment — are per-axis, which is exact
  rather than approximate there: a vertical guide is matched by a horizontal
  distance, so it answers to `scale.x` alone.

  `matchAlignment`'s `worldTolerance` parameter is now `{ x, y }` rather than a
  number. Pass the same value twice for a world-space tolerance.

  `meanScale` stays, for the two things that legitimately have no per-axis
  answer: hairline stroke widths, where the renderer takes one width, and painted
  chrome placement, whose per-axis form doesn't separate under a rotated target.
  Its doc now says so.

- 8853e73: Affordance hits are claims, and an exclusive claim outranks the scope tier.

  `AffordanceHit` gains `strength`, and `owner` naming what produced the hit. Kit
  chrome claims `'shared'`, which is what it always did: compete on scope and
  specificity. Registered layers, whose hits previously flattened to a bare kind
  string and a payload, now return a `LayerHit` that can also carry `cursor` and
  `strength`, so a consumer's own chrome says the things kit chrome already said
  through `AffordanceRegion`. `owner` is groundwork — nothing binds on it yet, and
  today only diagnostics read it; target it with `kindOf` or `affordance:<kind>`.

  **Behavior change.** When a press carries an exclusive claim, only bindings
  whose `target` consults the affordance — a `kindOf` predicate, or the
  `affordance:<kind>` string form — are candidates. Scope ordering applies within
  that filtered set, unchanged. Body-class targets (`'empty'`, `'selected-body'`,
  `'unselected-body'`) and `kind:` targets resolve from the body classification
  and never see the affordance, so they no longer win presses on chrome floating
  over the body they name.

  This is the dispatcher rule the previous release's changeset said was the real
  fix. `select`'s marquee no longer needs its hand-written predicate declining
  chrome affordances, and it is deleted; `rect`, `ellipse`, `polygon`, `star`,
  `hand`, `pen` and `lasso` keep their bare `{ kind: 'drag' }` bindings and stop
  swallowing drags on HUD chrome anyway, which is the point — seven copies of a
  predicate was the alternative. (`select`'s _click_ binding keeps a predicate of
  its own, for an unrelated reason: resize and rotate bind only drag, so a click
  exactly on a handle would otherwise clear the selection.)

  The filter is hard: if an exclusive claim leaves nothing eligible, the press
  does nothing. A dev-only warning names the owner the first time that happens for
  each owner, because the failure is otherwise silent.

  **What a claim does not reach.** Only gestures that carry an affordance are
  filtered, and keyboard events never do. Which pointer-family gestures carry one
  is settled by the per-kind claim work later in this release — see "A widget
  declares which gestures it consumes." The filter outranks hotkey scope as well
  as active scope, so holding space to pan no longer pans while the pointer is
  over HUD chrome.

  `@weasel-js/hud` claims exclusively, and `Widget` gains `cursorAt(x, y)`, which
  resolves a cursor per point rather than from hover state; `hud.window()`
  implements it, so hovering a resize band shows `nwse-resize` instead of the
  active tool's cursor. A widget can also stay transparent to input — `rect`,
  `text`, `label` and `image` are decoration — so a backdrop widget no longer
  eats presses meant for the canvas or for widgets beneath it. That occlusion
  predates this release, but an exclusive claim would have widened it from "HUD
  elements occlude each other" to "HUD elements kill every tool underneath."

  `WindowWidget.cursor` is removed. Nothing read it; `cursorAt` replaces it.

- 43482ce: A registry entry declares what it contributes and when it is eligible.

  `Contribution` is the entry type: `bindings`, `actions`, an `overlay`, a
  `presentation`, each optional and independent. `Tool<TScratch>` is now the
  **focus-declaring case** of one — it keeps only what a mode the user switches
  into needs (`initScratch`, the lifecycle hooks, the preview hooks, a `cursor`
  closing over its own scratch). An entry that only routes input declares only
  bindings and actions, which is what `@weasel-js/hud` always was.

  `Eligibility` is a set of conditions rather than one value, because one entry
  holds several: the hand tool is palette-selectable _and_ space-held. `focus`,
  `offhand: HotkeyTrigger`, `always`, `claimed`, plus `capabilities` as a modality
  filter — `@weasel-js/modes` now reads its tags from there. The scope tier a
  binding matches at is derived from whichever condition is live, ordered to match
  the dispatcher's existing hotkey > active > ambient walk. Nothing about that
  walk changed; what changed is that an entry lands in a tier because of what it
  declares about itself rather than which argument a consumer passed it in.

  `useContributions` is the assembly point, and `useTools` is a shim over it with
  its shape unchanged.

  **Breaking — `@weasel-js/hud`:** `createHudTool` / `useHudTool` are now
  `createHudContribution` / `useHudContribution`, with no alias. The old names were
  half of the same misstatement as the `as unknown as Tool<null>` cast they
  required; keeping them would preserve exactly what this corrects.

  **Breaking — `DispatcherContext.ambientToolIds` is removed.** A host driving the
  dispatcher directly declares `eligibility: { always: true }` on always-on entries
  instead. `useTools` consumers are unaffected; the shim sets it.

  **Behavior — a declared held-key trigger now wires itself.** `ToolDef.hotkey` was
  read by the inspector and wired nothing; the engagement lived in a host-side
  registration keyed by tool id (`BUILTIN_OFFHAND_ACTIONS`, now gone). Assembly
  registers the consolidated `tool.offhand` action from the declarations, so a tool
  that wants space declares it — `useHandTool` does. A host that also registered
  `tool.offhand` by hand should stop.

  **Behavior — `useTools` returns shallow copies** for ambient entries and
  `hotkey`-declaring tools, since it adds the declaration they were missing.
  Registry tools from `defineTool` are returned unchanged.

  **Behavior — route-conflict reporting now also sees action `defaultBinding`s.**
  The dispatcher always matched against them; the reporter never saw them, so a
  tool binding colliding with an action default went unreported. It no longer does.
  Dispatch is unchanged.

  Also added: `mergeContributions(...bundles)`, which concatenates and throws on a
  duplicate id rather than silently dropping one — the recorded plugin/bundling v1,
  whose deferral condition was "≥2 plugin-shaped features in flight."

  **Not done, so the seam is stated rather than implied:**
  `EligibilityState.heldTriggers` exists and `liveScope` honors it, but nothing
  populates it. `tool.offhand`'s invoker still reports engagement by pushing a tool
  _id_, which `engagedIds` reads, so the declaration registers the binding while
  the id carries the tier. Retiring that means changing `tool.offhand`'s contract.

- 9ed1139: Gradient fills that stay attached to their shape, and an editor for them.

  Gradient geometry was interpreted in screen space: `draw.ts` set the shader's
  `u_worldInv` to the identity matrix, with a comment saying a later step would
  wire the real view inverse. Nothing did. Every gradient therefore slid across
  its own geometry under pan and zoom, which is why the gradient demo shipped
  with pan and zoom disabled. Fine for a viewport-fixed wash, useless for a
  paint on a shape.

  Gradient paints now carry `units`, mirroring SVG's `gradientUnits`:

  - `'bounds'` — fractions of the painted node's box, `0..1` per axis (SVG
    `objectBoundingBox`). Resolved by the node painter, so the paint follows the
    node through moves, resizes and rotation.
  - `'local'` — the frame the geometry was handed to the renderer in.
  - `'world'` — scene coordinates; the paint holds still while geometry moves
    through it (SVG `userSpaceOnUse`).
  - `'screen'` — surface pixels, and the default, so every existing gradient
    keeps the behavior it had. WeaselDraw's workspace tint wants exactly this.

  `WeaselRenderer.render` takes an optional view matrix for `'world'`, and falls
  back to screen space without one. `fillInPoseFrame` resolves `'bounds'` against
  a box and `fillToBoundsFrame` inverts it; `mat3.invert` is new alongside them.
  Supporting helpers: `sampleGradientStops`, `withGradientKind`,
  `gradientGeometry`, `gradientForBounds`.

  `setFill` takes a whole `paint` as well as a `color`, so a gradient edit is one
  undo entry like any color edit. A `color` no longer tries to inherit alpha from
  a fill that is a gradient.

  New in `@weasel-js/ui`: `<GradientEditor>` (kind switch, stop strip, per-stop
  color) and `<GradientHandles>` (on-canvas endpoint / center / radius / angle
  handles, positioned through consumer-supplied `toScreen` / `toLocal` so it
  needs no view or scene of its own). Both split live `onInput` from committed
  `onChange`.

  Converting between kinds is lossy in ways the data makes unavoidable: a radial
  gradient stores no angle, so a round trip through one leaves the segment
  horizontal, and a conic stores no radius, so a round trip through one resets
  the segment's length.

  `'bounds'` is not a frame you can do polar math in: `x` and `y` are fractions
  of two different lengths, so a circle in it is an ellipse on screen.
  `<GradientHandles>` therefore takes a gradient already resolved by
  `fillInPoseFrame`, and consumers convert edits back with `fillToBoundsFrame`.

- 6aaa469: Group resize scales a rotated child along its own axes.

  Resizing a group applied the group's per-axis scale straight to each leaf's
  axis-aligned `width` and `height` and carried `rotation` through untouched.
  That is correct when `src`/`dst` are already in the leaf's own frame — the
  single-leaf path, where the drag delta is projected into that frame before the
  anchor math runs — but in a group they are world-frame, and a rotated leaf's
  local axes are not the axes being scaled. At 90° a horizontal stretch grew the
  leaf's `width`, when its world-horizontal extent is its `height`.

  New `remapRotatedLeaf(pose, src, dst)` in `interactions/actions/resize/geometry`
  applies the group affine to the leaf's local frame and drops the shear, which
  the `{x, y, width, height, rotation}` pose model cannot represent. The centre
  moves exactly; each local axis takes the length of its own image; the rotation
  follows the image of the local x-axis. `resizeAction` uses it on the group path
  for any leaf with a rotation, and nowhere else — the unrotated leaf and the
  single-leaf path are byte-identical to before.

  Rotation and `width` compose exactly under repeated application; only `height`
  drifts, since the perpendicular of a mapped axis is not the image of the
  perpendicular — that gap is exactly the dropped shear. It does not accumulate
  during a drag: every move remaps from the gesture's start poses, not from the
  previous preview.

- 40dd97d: A widget declares which gestures it consumes, and a claim bars only those.

  A HUD widget could be pressed, dragged and hovered and nothing else. The gap
  was in the dispatcher: `affordanceAt` ran on `pointerdown` and hover only, so
  `doubleclick`, `contextmenu` and `wheel` carried no affordance and no binding
  could gate on one. All four now do — `doubleclick` replays it from its press,
  `contextmenu` classifies its own position (a secondary button never reaches
  `onPointerDown`, so there is nothing to replay from) and gains world
  coordinates it never carried, and `wheel` classifies the point under the
  cursor. The immediate-invoker param bag, which forwarded position for `click`
  and `pointerdown` only, now covers `contextmenu`, `longpress` and the
  affordance on all four.

  **Behavior change, and the reason for the rest of this entry.** An exclusive
  claim previously meant _this pixel is mine_. Under that rule, giving `wheel` an
  affordance would have killed scroll-to-zoom over every floating panel. It now
  means _these gestures are mine_: `LayerHit` and `AffordanceHit` gain
  `claimedKinds`, a set over the new `ClaimableGesture` union (`'pointer'` —
  covering `pointerDown` / `click` / `drag`, one press protocol — plus
  `'doubleClick'`, `'contextMenu'`, `'longPress'`, `'wheel'`). Omitting it bars
  everything, which is what an exclusive claim did before.

  `Widget.claims` is that set. Absent means every kind but `wheel`, so
  right-clicking or double-clicking HUD chrome stops acting on the scene
  underneath while scroll-to-zoom over a panel is unchanged; a widget that wants
  the wheel asks for it. `claims: []` is decoration and replaces `claimsPointer`,
  which is removed. `HudPointerEvent` gains `doubleclick`, `contextmenu`,
  `longpress` and `wheel` arms.

  `PointerClaim` and `onPointer`'s return type are removed. The return was
  discarded at every call site, and it cannot be made live: the claim filter runs
  at match time, before any widget is consulted, so there is no later moment at
  which returning `'pass'` could restore a binding the filter already dropped.

  **Two matcher fixes this depends on.** `doubleClick` and `contextMenu` passed
  the DOM target to `matchTarget` where `click`, `drag` and `longPress` pass the
  affordance; a `kindOf` predicate on either kind therefore received an element
  no predicate in the kit expects. They now match the others. And the kit's body
  predicates — `isBody`, `isSelectedBody`, `isUnselectedBody`, `isEmpty` — carry
  `readsAffordance: false`, which `targetConsultsAffordance` honors. Each has a
  `kindOf` but reads only `bodyTarget`, so the filter inferred that they consult
  the hit and let them survive a claim; with `doubleclick` now carrying one,
  `enterPathEdit`'s `kindOf: isBody` would otherwise have entered path-edit mode
  on a double-click over chrome.

  `WheelSpec` gains `target`, and `wheel` gains a route-grammar target slot —
  a wheel binding could not gate on anything at all before.

- 531150f: A loupe, and the window primitive it needed.

  `hud.window()` is a draggable, resizable frame drawn in WebGL over the canvas —
  titlebar, eight resize bands, close box. It paints no interior. Interiors come
  from a new optional `content` painter on `Widget`, which `attachHud` draws
  beneath every widget frame in the same layer, clipped to `contentRect`. That
  painter receives `HudContentCtx`, carrying the scene data and view the hud layer
  was already handed; `HudDrawCtx` stays data-free, so widgets remain renderable
  headlessly. Painter commands are in absolute canvas coordinates — the group
  carries a clip, not a transform.

  `createLoupe()` is the first consumer: a window whose interior shows either the
  scene re-rendered through a magnified inner view, or the actual framebuffer read
  back and magnified 1:1. Both modes exist because neither answers both questions
  honestly — a re-render is crisp at any magnification but its antialiased edge
  colors are not the colors on screen, so the hex readout samples the framebuffer
  in either mode. The frame stays parked and the pointer aims it; content freezes
  while the pointer is over the window, which is what keeps the borders reachable.
  Aiming uses its own `pointermove` listener rather than hud hover, because hud
  hover comes from the layer's `onUncapturedMove` and stops during a captured drag
  — exactly when a magnifier is most wanted.

  Also fixed in the HUD: `hud.drag` pumped **world** coordinates into widgets
  while `hud.press` sent screen coordinates, because the dispatcher builds
  move/end contexts with an empty dep bag and the `view` lookup silently fell
  through. Invisible at zoom 1, and a window that jumped and tracked backwards at
  any other zoom. The drag action now captures its deps at gesture start.

  `ImageDrawCommand` gains `sampling: 'linear' | 'nearest'`, applied per draw at
  bind time rather than at upload, since `GLImageCache` keys textures by bitmap
  identity. Without `nearest`, magnifying a framebuffer readback comes back
  blurred, which defeats the readback.

  **Behavior change in `@weasel-js/core`:** the select tool's area-select drag now
  declines presses that a registered layer's hit-test claimed. It bound
  `{ kind: 'drag', target: 'empty' }`, and the string form of `target` resolves
  from the body only — chrome floating over empty canvas read as empty canvas, so
  area-select swallowed drags on HUD widgets. The adjacent `clearSelection` click
  binding already had the correct shape. Other tools that bind a bare
  `{ kind: 'drag' }` still have this hole.

- 596253e: The built-in path and shape painters accept a `FillStyle` in `data.fill`.

  `kit:path` and `kit:shape` typed `data.fill` as a color string and emitted
  `{ color }`, so a node could not carry a gradient or a pattern without the
  consumer registering a painter of its own — even though the renderer has taken
  every `FillStyle` variant since the paint model landed. The two painters were
  the narrow point, not the renderer.

  `data.fill` is now `string | FillStyle` (exported as `NodeFill`). A string
  still means a solid color, `'none'` still skips the fill, `undefined` still
  falls back to `data.color` and then to the default — and only when there is no
  stroke, so a stroke-only pencil path stays unfilled. An object is used as-is.
  `ink()` agrees with `paint()` on all of it, which the existing agreement test
  plus a new one both check.

  One behavior change beyond the widening: `kit:shape` used to paint `'none'` as
  a literal color, since only `kit:path` special-cased it. It now skips the fill,
  matching `kit:path` and matching what the string obviously means.

  This is the kit half of gradient and texture fills. The app half — widening
  WeaselDraw's own data shape, a fill-kind switch in the properties panel, a
  gradient editor with on-canvas handles, and matching SVG `<linearGradient>` /
  `<pattern>` export — is untouched.

- 22eafe6: Pattern fills tile, persist, and round-trip through SVG.

  The `pattern` variant of `FillStyle` never tiled. `drawPathFillPattern`
  borrowed the `imageFill` program while binding the path fill mesh VAO, which
  enables `a_position` only — `a_uv` was never bound, so `v_uv` was the constant
  `(0, 0)` and every fragment sampled texel (0, 0) of the tile. Textures also
  uploaded with `CLAMP_TO_EDGE`, so correct UVs alone would have smeared rather
  than repeated. The variant had no visual consumer, which is why it went
  unnoticed.

  `patternFill` is now its own program, taking `gradFill`'s vertex stage:
  paint-space coordinates come from the screen position through `u_worldInv`
  rather than a UV attribute, so the path mesh keeps its position-only layout.
  `GLTextureCache.upload` takes a wrap argument and pattern textures bind
  `REPEAT`.

  Patterns pick up `units` alongside gradients. For a pattern it names the space
  the tile's **origin and scale** live in — not geometry, which a pattern hasn't
  got. `'bounds'` anchors the tile to the painted node's box, so dragging the
  node carries the pattern and resizing reveals more tiles instead of stretching
  them; `fillInPoseFrame` rebases it by translation only.

  `TilePatternSpec` is the serializable payload — plain data naming a built-in
  tile (`hatch`, `crosshatch`, `dots`, `chunks`) plus its parameters:

  ```ts
  { fill: 'pattern', pattern: { tile: 'hatch', color: '#0fb5a8', size: 8 }, units: 'bounds' }
  ```

  `resolvePatternSpec` turns one into a `TextureHandle` at paint time, memoized
  on the spec's values so identical specs share a texture. The built-in painters
  resolve it alongside `fillInPoseFrame`; a consumer emitting its own draw
  commands resolves it at the same place it calls that one. A `TextureHandle`
  payload still works untouched, but cannot be persisted or exported — prefer
  the spec.

  `@weasel-js/svg` serializes a tile spec as a `<pattern patternUnits=
"userSpaceOnUse">` whose children come from the same tile description that
  rasterizes the texture, so the vector and raster forms cannot drift. The spec
  rides along on `data-weasel-tile` for lossless re-import; a hand-authored
  `<pattern>` without it is dropped with a warning rather than guessed at.
  `SerializeOptions.onWarn` is new, and reports paint that SVG cannot express —
  a conic gradient, or a pattern carrying a `TextureHandle`.

  `tilePreviewSvg` / `tilePreviewCssUrl` render a single tile as a standalone
  `<svg>`, for pickers that need to show a tile outside a document.

- cd23624: A text run can turn off a flag its node sets.

  Run-level `bold` / `italic` / `underline` / `strikethrough` are additive over
  the node's `TextStyle` — a run turns a flag on, never off. So "select a word
  inside an underlined node and hit U" was unrepresentable, and the character bar
  could only refuse.

  New `setFlagOverRange(runs, style, start, end, key, value)` in
  `features/text/runs/flagRange`, exported alongside `nodeHasFlag`. Turning a
  flag on, or off in a node that doesn't set it, is the ordinary additive write
  and returns the style untouched. Turning it off in a node that _does_ set it
  clears the node flag and raises it on the runs outside the range: identical
  rendered result, expressible edit, and `StyledRun` unchanged — so nothing a
  document can already contain changes meaning.

  That is the answer to the recorded question of tri-state versus
  normalize-on-write, and it is not close. A tri-state run flag cannot cover
  `bold` or `italic`: those are booleans on a run but `fontWeight` and
  `fontStyle` on the node, so a run's `false` has no node-level boolean to
  override. Tri-state fixes two of the four flags; this fixes all four, and
  without widening the persisted shape.

  One case is declined rather than approximated. `run.bold` resolves to exactly
  700 everywhere, so a node at `fontWeight: 900` cannot have its weight pushed
  onto its runs without lightening the text that was _not_ edited. That returns
  `applied: false` and writes nothing; a control should disable rather than
  silently downgrade.

  `useTextEdit` takes an optional `setStyle(id, style)` for this — the hook could
  read the node style but had nowhere to write one back. Omit it and the toggle
  declines exactly as it does today.

### Patch Changes

- Updated dependencies [43482ce]
- Updated dependencies [40dd97d]
  - @weasel-js/modes@1.0.0
  - @weasel-js/gestures@1.0.0
  - @weasel-js/font@1.0.0
  - @weasel-js/geom@1.0.0
  - @weasel-js/history@1.0.0

## 0.8.0

### Minor Changes

- bdcdfe5: Clipboard keyboard actions, and two bugs the wiring flushed out.

  `clipboard.copy` (Cmd/Ctrl+C) and `clipboard.cut` (Cmd/Ctrl+X) are kit-standard
  descriptors. Publish the imperative surface `useClipboardOps` returns as the new
  `clipboard` dep and both work; the buttons a consumer already has and the
  shortcut then route through one implementation instead of two. Cut is copy plus
  the same batched delete `deleteAction` performs — one undo entry.

  There is deliberately no `clipboard.paste`. Cmd/Ctrl+V already arrives as a DOM
  `paste` event, which the dispatcher routes to `ingest` and the content-handler
  registry — the path that reaches the OS payload. A key binding would fire
  alongside it and paste twice.

  Two older bugs, both found by actually pressing the keys:

  - **Deleting a container together with its children threw mid-batch.**
    `removeNode` cascades the subtree, so a group's op already takes its members
    with it and the members' own ops then hit `unknown node id`. Selecting a group
    and its contents at once — what Cmd+A does — was enough. `deleteAction` and
    `clipboard.cut` now share one op builder that skips any id with a selected
    ancestor.
  - **Cmd+D did nothing at all.** Two faults stacked. `duplicate` threw before
    its `enabled` gate could answer, because the gate reads `deps.selection` and
    the descriptor never declared it — an undeclared read the dev-build deps
    Proxy treats as an error. Declared now, with a sweep test over every
    `requiresSelection`-gated descriptor so the next one can't ship the same way.
    And underneath that, the invoker was a stub whose body was `void params`,
    deferring to a "legacy bridge" that no longer exists. `duplicateAction` now
    really duplicates: each selected node with its whole subtree (so a duplicated
    group comes out populated, not empty), offset by the same 12 units a paste
    gets, as one undoable batch, with the copies selected afterward. Descendants
    are offset only for absolute-pose scenes — with a `poseComposition`
    registered, poses are relative and moving the root already carries them.

  `polygonHitTestRect` moved from `features/paths/` to `core/geometry/`: it is
  pure geometry, `core/adapters/arrayAdapter.ts` needs it, and core may not import
  from features. Same exports from the package barrel.

- e0ab60e: Device profile: the kit stops assuming a mouse.

  `DeviceProfile` is one object holding pointer coarseness, hover capability and
  pixel density, resolved once per `<SceneCanvas>` and published to its subtree.
  Two things read it. The chrome-caps rule layer gains `coarsePointer:` and
  `canHover:` selectors (plus matching fluent atoms), so consumers can gate
  chrome on the device. And every handle size and hit radius — six independent
  literal `8`s and one `24` before this — now derives from one base module times
  `DeviceProfile.targetScale`, so a coarse pointer gets 14px handles and a 42px
  rotation distance without paint and hit-test ever drifting apart. The public
  `DEFAULT_HANDLE_SIZE` / `DEFAULT_ROTATION_HANDLE_DISTANCE` constants keep
  their unscaled values.

  `longPress` is a real gesture kind: spec, event, matcher, and route grammar.
  The dispatcher synthesizes it for touch and pen presses held 500ms without
  crossing the drag threshold — never for a mouse, and cancelled by movement,
  release, cancel, or a second finger landing. An unmatched long-press
  re-dispatches as `contextmenu`, so existing `contextMenu` bindings become
  reachable by touch with no consumer change.

  Also fixes a density bug: `useCanvasSize` read `devicePixelRatio` only inside
  its `ResizeObserver` callback, so moving a window to a different-density
  display without resizing it left the snapshot stale. Density now comes from
  the profile, which watches a re-armed resolution media query.

  Override any of it with the new `<SceneCanvas device={{ coarsePointer: true }}>`
  prop — for tests, for demos that want touch-sized chrome on a desktop, and for
  hybrid devices where the media query guesses wrong.

- 3d693c7: Underline and strikethrough shortcuts, and the core boundary goes strict.

  Cmd/Ctrl+U toggles underline and Cmd/Ctrl+Shift+X toggles strikethrough, both
  through `toggleFlagInRange` like bold and italic — so they toggle _off_, a mixed
  range turns fully on, and a collapsed caret gets a pending style that styles the
  next character only. `rangeStyle.ts` had listed both flags all along; only
  `useTextEdit`'s `StyleFlag` and its keydown switch were narrower.

  Underline in particular had to be intercepted rather than merely supported.
  Left alone, the browser ran its own `formatUnderline` and `domToRuns`' `<u>`
  flattening made that look like it had worked while bypassing the run algebra
  entirely. The flattening stays — it's what lets pasted decoration survive — but
  it was never the mechanism. Bare Cmd+X is deliberately left to the browser so
  cutting text mid-edit still works; only Cmd+Shift+X is claimed.

  The `core/` ← `features/`/`interactions/` lint rule no longer exempts type
  imports. Three types core named across the boundary moved down to where core
  can own them — `Path` to `core/geometry/path.ts`, `RectPose` to
  `core/scene/types.ts` (whose doc comment already claimed it lived in core), and
  `ModifierState` to `core/modifierState.ts` — each with a re-export left at its
  old address, so no importer changes.

- e264d62: Stroked text.

  `TextStyle.stroke` and `StyledRun.stroke` carry a real `Stroke`, and the
  outline tier paints it as a second batched draw call over the group's merged
  geometry — so a glyph above `textOutlineMinScreenSize` gets real joins, caps
  and miters in any paint, because by then it is an ordinary `PolygonPath`.
  Width stays a world measure: it crosses into the cached em-space tessellation
  by dividing by the glyph's scale, so it does not grow with `fontSize`. Below
  the threshold a glyph is a sampled distance field with no geometry to stroke,
  and renders unstroked rather than approximated.

  `kit:text` also reads the kit-native `data.stroke` / `data.strokeWidth` leaf
  fields that `kit:shape` already honors, so one pair of stroke controls means
  the same thing on a text node as on a rect.

  `@weasel-js/svg` round-trips all of it — node-level and per-`<tspan>` — where
  it previously parsed a text stroke into a warning and dropped it.

  Two older bugs fell out of building it, both invisible to fills and both
  fixed: `extractPolylines` kept a closed contour's duplicate final point
  (zero-length closing segment, dropped wrap-around join), and glyph path data
  whose contours carried no `Z` stroked as open polylines — a missing closing
  edge with a cap at each loose end. A fill closes a contour implicitly; only a
  stroke reads the difference.

### Patch Changes

- Updated dependencies [e0ab60e]
- Updated dependencies [e264d62]
  - @weasel-js/gestures@0.8.0
  - @weasel-js/font@0.8.0
  - @weasel-js/geom@0.8.0
  - @weasel-js/history@0.8.0
  - @weasel-js/modes@0.8.0

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

- a19124d: `VERSION` reports the right number again. `@weasel-js/core@0.7.1` was published
  from a working tree whose `dist/` predated the version bump, so the constant
  baked into that tarball reads `0.7.0` while the package it ships in is `0.7.1` —
  the one export whose entire job is to say what you are running, saying the wrong
  thing. Nothing else in 0.7.1 is affected: the value is stamped at build time by
  `tsup`'s `define`, so only a stale build can desync it, and only `core` bakes it.

  npm tarballs are immutable, so 0.7.1 cannot be corrected in place. Anything
  pinned there should move to this release; `0.7.1` is deprecated on npm pointing
  here.

- Updated dependencies [8bc719a]
  - @weasel-js/font@0.7.2
  - @weasel-js/geom@0.7.2
  - @weasel-js/gestures@0.7.2
  - @weasel-js/history@0.7.2
  - @weasel-js/modes@0.7.2

## 0.7.1

### Patch Changes

- a3af158: Gestures are now keyed per pointer. `gestureIdFor` returned the literal string
  `pointer-mouse` with nothing interpolated — despite its own docs promising
  `pointer-<pointerId>` — so every pointer shared one in-flight handle slot and
  two pointer gestures could not coexist. Pointer events carry `pointerId` now
  and the id interpolates; events without one (synthetic probes, most tests)
  still key to `pointer-mouse`.

  That removes an accident the pinch path was relying on, so the multitouch
  policy is stated rather than implied: when a second pointer lands, the
  multitouch channel claims every pointer that hasn't already committed to a
  gesture, suppressing both drags and taps from those pointers. A drag already in
  flight keeps running — yanking a gesture away from someone who rested a palm is
  worse than letting it finish.

  `useTools` also reports routing conflicts now. `findConflicts` had been
  written, tested, and never called, so the kit could detect its one class of
  genuine routing ambiguity and never looked. It runs at registry assembly under
  a dev guard and warns each conflict in the grammar the route was written in. It
  warns and never throws: a consumer tool colliding with a kit tool can be
  deliberate, since the loser may still take the gesture by declining through
  `enabled()`.

- a3af158: Scenes with many shapes or much text draw far less work per frame. Two caches
  the kit already had were missing on essentially every node of every frame,
  because the values they key on were rebuilt each time.

  The tessellation cache (`WeakMap<Path, Mesh>`) keys on `Path` identity, but
  `kit:shape` allocated a fresh path for every ellipse, polygon and star on every
  draw. Painters now memoize `paint` against the node, so the same path comes
  back and the cache does its job: 1000 shape nodes went from 6.69 to 0.20
  ms/frame through paint and tessellation.

  Text layout is the larger one. `layoutRuns` — which walks every codepoint,
  resolves a face per run, measures, wraps and places each glyph — ran per text
  command per frame. It is now cached in the renderer, keyed on the resolved
  runs. 200 wrapped paragraphs went from 31.8 to 0.06 ms/frame, 1000 short
  labels from 12.5 to 0.42. The cache drops itself when a font becomes
  available, so text still reflows the moment the real face lands.

  Two contracts follow from this, for anyone writing a custom painter or calling
  these directly:

  - The array a painter's `paint` returns belongs to the painter. Treat it as
    immutable and copy before appending — `defaultDrawOne` now does, for its
    label overlay.
  - `registerFont` now notifies `subscribeGlyphReady` when a family finishes
    registering, so a font loaded mid-session repaints without waiting for an
    unrelated redraw. `glyphGeneration()` is a new pull-based companion to that
    signal, for caches that can't hold a subscription.

- 6af4806: Reorder: `Cmd/Ctrl+Shift+]` and `Cmd/Ctrl+Shift+[` now bring-to-front and
  send-to-back. The shortcut every drawing app uses could never fire — modifier
  matching is strict, so a binding without `shift` in its spec cannot match a
  keystroke that holds it, which also made the shifted `'}'` / `'{'` characters
  in those key lists unreachable. `Cmd+Alt+]` / `Cmd+Alt+[` remain as the
  fallback for browsers that reserve `Cmd+Shift+[`/`]` for tab switching.

  `BUNDLE_TOOLS.standard` no longer includes `pencil`. Freehand is a specialist
  instrument rather than part of the everyday shape-drawing set; it is still in
  `exhaustive`. Consumers wanting it back can pass `tools={{ pencil: true }}`
  alongside the bundle.

- a3af158: Clicks now land on the shape a node actually paints, not on its bounding box.
  The pose rect is the wrong answer for anything that isn't a rectangle: a click
  in a star's notch, in the corner outside an ellipse, or in the blank half of a
  text box went to the node that merely bounds that point, burying whatever was
  really underneath. `picking: 'shape'` had been available since it shipped and
  was opt-in only because flipping it changes what a click selects.

  Ink counts too, not just the boundary. A shape whose interior isn't filled —
  an outlined rect, a pencil stroke, a bare line — is now grabbable along its
  outline and not through its empty middle, which is the opposite of what a fill
  test alone answers. Painters declare this through the new `NodeShapeEntry.ink`;
  one that declares none is treated as filled, the previous behavior.

  Pass `geometry={{ picking: 'pose' }}` to `SceneCanvas` for the old rect
  behavior. Painters with no silhouette are unaffected either way, so nothing
  becomes unreachable.

- 2003597: Export `VERSION` — the kit version a build was compiled from, baked in at
  build time. Apps can pair it with their own compile timestamp to report what
  they're running (WeaselDraw now shows `0.7.0 · Jul 30` in its status bar).
- Updated dependencies [6af4806]
- Updated dependencies [a3af158]
  - @weasel-js/font@0.7.1
  - @weasel-js/geom@0.7.1
  - @weasel-js/gestures@0.7.1
  - @weasel-js/history@0.7.1
  - @weasel-js/modes@0.7.1

## 0.7.0

### Minor Changes

- d3e5597: Extract the MSDF glyph tier into a new `@weasel-js/font` package: font
  registry, atlas parsing, glyph layout, runtime rasterization, and the SDF
  text shader source. `@weasel-js/core` depends on it; `registerFont` is still
  re-exported from `@weasel-js/core/renderer`, so existing call sites keep
  working.

  Unregistered font families now render in the default family with a one-time
  warning instead of rendering nothing. Configure with
  `setFontFallbackPolicy('substitute' | 'canvas' | 'none')` — `'none'`
  restores the previous hard-miss behavior, and `'canvas'` rasterizes the real
  typeface at runtime when the browser has it. A family the `'canvas'` policy
  enrolled for itself stops being canvas-served once the policy changes; one
  you name with `registerCanvasFont` is served under every policy, and
  `isCanvasFont` reports that distinction — it answers "will the dynamic tier
  serve this family right now", so an auto-enrolled family reads `false` under
  `'substitute'` and `'none'`. The default
  family may be a canvas-registered family, and when it cannot serve the
  request either, the resulting blank text is reported with its own warning
  naming the default family rather than failing silently. Requesting the
  default family itself also warns — whether it is registered at a variant it
  can't serve, or `setDefaultFontFamily` named a family that was never
  registered at all; either way there is nothing left to fall back to. An app
  that has registered no fonts and set no default stays silent, since that is
  not a misconfiguration.

  `ResolveResult.substituted` reports the substitution structurally, and
  `ResolveResult.resolved` now
  carries the matched `family` alongside `weight` and `style` — the full atlas
  identity to pass to `getFont` / `textureCacheKey`.

  Adds `listFonts()` for enumerating registered families.

- a925117: Text antialiasing is derived from the screen-space derivative instead of a
  constant.

  Both SDF text shaders computed their smoothstep band from a fixed `u_aaWidth`
  (0.05, set once per draw). A constant band cannot be correct at more than one
  scale: at 16px it collapsed to well under a screen pixel, so glyph coverage
  quantized to all-or-nothing and edges rendered as hard stair-steps; at display
  sizes the same constant read mushy. `TEXT_FRAG_SRC` and `TEXT_FRAG_R8_SRC` now
  take the band from `fwidth(sdfVal)`, which folds in font size, zoom, and DPR
  together, with a small floor so a degenerate derivative can't reproduce the
  aliased behavior.

  This changes how all GL-rendered text looks — most visibly at UI sizes, where
  it is the difference between binary and antialiased edges.

  Breaking, for anyone driving the shaders directly:

  - `u_aaWidth` is gone from both fragment sources and from `TEXT_SDF_UNIFORMS`.
    There is no CPU-side AA knob to set; the shader derives it. Setting the
    uniform was never useful — the kit only ever wrote 0.05 to it.

- eeae450: A codepoint the atlas never baked now falls back to a real glyph instead of a
  literal `?`.

  Font fallback resolved at family granularity: `resolveFontVariant` picks one
  tier for a whole run. But a baked MSDF atlas covers a fixed charset, so a run
  served by a perfectly good atlas can still contain a character that atlas has
  no glyph for — an em dash, a curly quote, anything outside the subset. Those
  drew codepoint 63. That fabricates a character the author never wrote and is
  indistinguishable from one they did; the committed text baseline read "Themed
  editing ? magenta caret" for a full commit without anyone noticing.

  `layoutRuns` now escalates the individual codepoint to the dynamic canvas
  tier, which rasterizes from installed fonts and can usually serve it for real.
  The escalated glyph gets its own draw group (different texture and shader) and
  is scaled by its own atlas's bake size. When escalation isn't available the
  character is skipped with a warning naming it, rather than substituted —
  `.notdef` is what a text stack should draw here, and the BmFont format has no
  such glyph.

  New in `@weasel-js/font`:

  - `resolveGlyphFallback(family, weight, style)` returns a canvas-tier
    `ResolveResult` for per-codepoint escalation, or `null` when it isn't
    available. Declines under the `'none'` fallback policy, which documents a
    miss as a hard miss, and when there is no canvas to rasterize into (SSR)
    rather than throwing into the layout pass.

- e7d71c9: Text properties: node-level typography through the schema-driven panel, and
  caret-range styling through a new tool options bar.

  `TextStyle` and `StyledRun` gain `letterSpacing`, `underline`, and
  `strikethrough`, with GL rendering, DOM-overlay, and SVG round-trips for all
  three. `styleAtRange` / `applyStyleToRange` expose the run algebra publicly,
  and `useTextEdit` gains `selection`, `rangeStyle`, and
  `applyStyleToSelection`. Text nodes get Character and Paragraph schema
  groups. New `ToolOptionsBar` component; `ToggleBar` renders indeterminate
  segments via `mixedValues`.

  Behavior changes worth knowing about:

  - **`SelectionPanel` reads and writes node paths of any depth** (two or more
    segments). It previously split at the first dot and read exactly one level,
    so `data.style.fontSize` resolved to `data['style.fontSize']`.
  - **The default `kit:text` painter paints a node's `runs`** when it has them,
    instead of re-flattening `data.text`. Run styling was previously invisible
    to anything drawn by the default scene layer.
  - **`useTextEdit` no longer commits when focus moves into editing chrome**
    (`isEditorChrome`), and commits on a pointerdown outside both the overlay
    and that chrome. Its published `selection` survives focus leaving the
    overlay — it clears on `startEdit` and when the edit ends. Without this a
    character bar could not exist: clicking its controls ended the edit they
    were there to change.
  - **The edit overlay can scale with the view** (`TextEditScreenPose.zoom`),
    keeping every metric on it — including run-level `fontSize` and
    `letterSpacing` — in world units. Omitting `zoom` keeps the old
    screen-pixel contract.
  - **The canvas-2D measurement path counts tracking**, as the GL path already
    did, so wrap points, `caretIndexAt`, and `fitTextPose` agree on tracked
    text. This moves wrap points on any text with a non-zero `letterSpacing`.
  - **The text tool enters edit on the box it inserts.**

  Breaking-ish, in packages that have not been published with these paths:

  - `splitNodePath` is removed from `@weasel-js/ui`'s public API — it was dead
    and encoded the superseded one-level path model. `nodeValueAt` and
    `setAtPath` are exported in its place.
  - A text node's color leaf is now `data.style.fill` of the new `paint` kind
    rather than `data.style.fill.color` of the `color` kind. `TextStyle.fill`
    is a tagged union, so the old leaf read `undefined` off a gradient and
    wrote a hybrid the renderer painted flat solid.

### Patch Changes

- Updated dependencies [d3e5597]
- Updated dependencies [a925117]
- Updated dependencies [eeae450]
  - @weasel-js/font@0.7.0
  - @weasel-js/geom@0.7.0
  - @weasel-js/gestures@0.7.0
  - @weasel-js/history@0.7.0
  - @weasel-js/modes@0.7.0

## 0.6.0

### Patch Changes

- @weasel-js/geom@0.6.0
- @weasel-js/gestures@0.6.0
- @weasel-js/history@0.6.0
- @weasel-js/modes@0.6.0

## 0.5.1

### Patch Changes

- @weasel-js/geom@0.5.1
- @weasel-js/gestures@0.5.1
- @weasel-js/history@0.5.1
- @weasel-js/modes@0.5.1

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
