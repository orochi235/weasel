# @weasel-js/font

## 1.9.1

### Patch Changes

- @weasel-js/registry@1.9.1

## 1.9.0

### Patch Changes

- @weasel-js/registry@1.9.0

## 1.8.1

### Patch Changes

- @weasel-js/registry@1.8.1

## 1.8.0

### Patch Changes

- @weasel-js/registry@1.8.0

## 1.7.3

### Patch Changes

- @weasel-js/registry@1.7.3

## 1.7.2

### Patch Changes

- @weasel-js/registry@1.7.2

## 1.7.1

### Patch Changes

- 8635031: Every text tier now places its baseline from the ascent and descent a browser
  sets the face with, and centers the face in its line the way CSS does: half
  the leading above the ascent. A face taller than its line box, such as Papyrus
  at `lineHeight: 1.2`, gets negative leading and overflows the box, which keeps
  its height. Before, a line hung its baseline one ascent below the line top
  with no leading, so glyphs sat half the leading away from where CSS puts
  them: high in a roomy line, low in a tight one, where a tall face overflowed
  only at the bottom.
  
  The ascent rule is `verticalMetricsFromTables` (new, additive, in
  `@weasel-js/font`): `OS/2` typo metrics when the font sets
  `USE_TYPO_METRICS`, otherwise `hhea`. Firefox and every Linux engine follow it;
  Chromium and WebKit on macOS read `hhea` regardless, and the edit overlay's
  measured correction covers the difference there. `gen-font` bakes the result
  into the atlas's `faceMetrics` block as `ascent` / `descent`, the outline
  parser reads the same values (and reports them as `OutlineFace.ascender`), and
  the canvas tier records the browser's own, measured at a 1000px em rather than
  at the 48px bake size. An atlas or custom parser that states no ascent and
  descent keeps the previous placement.
  
  Rendering changes: text in the bundled Inter at `lineHeight: 1.2` moves up by
  0.005 em. Canvas-tier faces move down by half their leading: Georgia by 1.3px
  and Arial by 1.7px at 40px. The committed Inter atlases are rebaked; the PNG is
  byte-identical.
- 3d80c9f: Text can become path geometry. `textToPath(data, pose)` returns a text node's
  glyph outlines and decoration rules in world space, as one `'nonzero'`
  compound path whose filled region is their union. Glyphs keep the font's
  curves, and each glyph is re-wound so faces that disagree on winding still
  fill their overlaps. It works at any size, not only above the outline-tier
  threshold, and applies synthetic italic the way the renderer does. When some
  run has no outline geometry it throws a `TextOutlinesError` whose `reason` is
  `'no-outlines'`, `'outlines-loading'`, `'outlines-failed'` or
  `'synthetic-bold'`. Faux bold is refused rather than drawn at the regular
  weight, because a path has no distance field to thicken.
  `loadTextOutlines(data)` waits for the faces a text is set in.
  
  The new `createOutlines` action (Shift+Mod+O, group `'text'`, under the
  `paths` feature) replaces each selected text node with a path node in one
  undoable batch. Each path takes its text node's slot in the stacking order.
  Consumers publish a `CreateOutlinesAdapter` with `useCreateOutlinesAdapter`;
  its `createPathNode(path, sourceId)` carries the text's fill and stroke. The
  pure core is `applyCreateOutlines`, and the icon is `CreateOutlinesIcon`.
  
  Boolean ops take text operands: `BooleansAdapter` gains an optional
  `getTextSource(id)`, consulted when `getWorldPath` has no path. This change is
  additive, with one exception: `BooleanOpResult` has a new
  `{ kind: 'failed', reason: 'text-outlines' }` variant, and a text operand
  without outlines now leaves the scene untouched. Code that switches
  exhaustively over `BooleanOpResult` needs a case for it.
  
  Also new: `loadFontOutlines(family, variant?)` in `@weasel-js/font` (also
  re-exported from core) resolves once a registered face has loaded or failed.
  `@weasel-js/geom` adds `pathSignedArea` and `reversePath`.
- a7f2103: Underline, strikethrough and super/subscript now follow the font's own metrics
  instead of fixed constants. `gen-font` bakes `post.underlinePosition` /
  `underlineThickness`, `OS/2.yStrikeoutPosition` / `yStrikeoutSize` and the
  `OS/2` super/subscript size and offset into a new optional `faceMetrics` block
  in the atlas JSON, and the outline parser reads the same values onto
  `OutlineFace.faceMetrics`, through one shared function, so an atlas and a TTF
  of one font place rules and scripts identically. The overline keeps its
  default offset and takes the underline's weight. A face with no metrics
  (older atlases, the canvas tier, custom parsers) keeps the previous constants.
  
  This changes rendering for the bundled Inter: its underline sits lower
  (0.170 em, was 0.10) and heavier (0.068 em, was 0.05), and `script: 'sub'`
  drops by 0.075 em instead of 0.333 em, with scripts at 60.0% size. The
  committed atlases are rebaked; the PNG is byte-identical.
  
  Additive API: `faceMetricsFromTables`, `faceMetricsOf`, `faceMetricsFor` and
  the `FaceMetrics` types in `@weasel-js/font`; `scriptMetrics`,
  `scriptMetricsFor`, `decorationMetrics` and `DEFAULT_DECORATION_METRICS` in
  `@weasel-js/text` (re-exported from core); an optional `faceOf` argument to
  `layoutMarkdown` and an optional `face` on `PositionedRun`. `SCRIPT_METRICS`
  remains, now documented as the fallback rather than what every run gets.
  
  Fix: `resolveFontVariant` called from inside the glyph-ready notification of
  an atlas that just landed returned a pending miss, because the load was still
  marked in flight. A subscriber that re-resolves synchronously, as
  `useSyncExternalStore` does, now sees the face.
- edabd62: `layoutRuns` no longer warns "no metrics for …" about a face whose registration is still loading — an un-awaited `registerFont`, or an outline face whose bytes have not arrived. It warns once that registration settles and the face still resolves to nothing. New `fontPending(family, weight?, style?)` answers whether a registration in flight could still serve a request. A failed `registerFont` or outline load now fires `subscribeGlyphReady`, so text laid out while it was pending gets laid out again.
- 7be3713: Changing what a family resolves to now repaints the text drawn in it. `setFontFallbackPolicy`, `setDefaultFontFamily`, `registerCanvasFont` and `unregisterCanvasFont` each advance `glyphGeneration()` and notify `subscribeGlyphReady` when they change something. Before, text already on a canvas kept its cached layout from before the change: switching to `'none'` left a substituted line visible, and enrolling a family at runtime did not redraw it. A call that changes nothing still notifies nobody.
- b5cc59f: Small atlas text no longer loses stems narrower than a pixel. The shader used
  to size its antialiasing band from the derivative of the distance field. That
  derivative reads flat when a 2x2 pixel quad straddles a thin stem, so the band
  collapsed and the stem disappeared. A 12px superscript `H` in Inter rendered at
  DPR 1 without its left stem. The band now comes from the screen derivatives of
  the texture coordinate, scaled by each atlas's page size and field range.
  
  Additive: `glyphFieldScale(source, family, weight, style)` is exported from
  `@weasel-js/font`, and `BmFont` gains an optional `distanceRange` read from
  msdf-bmfont-xml's `distanceField.distanceRange`. `GLYPH_COVERAGE_GLSL`'s
  `glyphCoverage` now takes two more arguments, `uv` and `fieldPerUv`. That breaks
  any custom program that pastes the snippet in and calls it.
- 3c1def2: `registerFont` takes a fifth argument, `{ lazy: true }`, which fetches nothing
  until text first lays out in that family — so a scene with no text never
  downloads the atlas. Until the atlas lands, a run set in the family lays out as
  nothing rather than in a fallback face's metrics, and `<SceneCanvas>` repaints
  it when the atlas arrives. The returned promise settles with that load, so it
  never settles for a face no text uses; don't `await` it at startup. New type:
  `RegisterFontOptions`.
  
  A family whose atlas is still fetching, eagerly or lazily, now outranks the
  outline tier and the `'substitute'` fallback while it loads: text waits for the
  real face instead of laying out in another one and reflowing when it arrives.
  The same holds for a registered-but-unloaded exact variant, which is no longer
  faked from a sibling weight in the meantime. `listFonts` and `listFontWeights`
  report lazily registered faces before they load.
  
  `@weasel-js/hud` registers its bundled Inter lazily, so attaching a HUD whose
  widgets draw no text no longer downloads it. `registerDefaultFont`'s promise now
  settles when a widget first lays out text.
- 9cad63b: The text edit overlay now sets its glyphs in the face the canvas draws. A family
  the canvas draws from a baked atlas or from outlines — `sans-serif` registered
  to Inter, say — used to reach the overlay as a bare CSS name, which the browser
  resolved to its own face (Helvetica on macOS), so "Hxgd" at 72px ended 12px
  short of the canvas. New `cssFontFamily(family, variant)` answers the CSS
  `font-family` for whatever the canvas draws: a private `FontFace` built from the
  family's `registerFontOutlines` file, with the family name as fallback. A family
  drawn through the browser (`registerCanvasFont`) comes back unchanged. An atlas
  with no font file cannot give the DOM its face, and says so once in the console;
  register the file it was baked from with `registerFontOutlines`.
  `OutlineFontOptions.cssSrc` names the `@font-face` source where the bytes won't
  do, and `enableLocalFontOutlines` sets it to `local(<PostScript name>)`.
  
  The bundled Inter atlas carries the font's own advances and kerning. It used to
  lay out on whole-pixel advances at its 32px bake size with no kerning at all, so
  "Hxgd" at 72px set 182.25px wide against the 179.44px every browser gives the
  same face, and "AVATAR" 22px wide of it. `gen:font` now writes advances at full
  precision and kerning pairs read from the font's GPOS table, and the atlas is
  rebaked from `inter.ttf`. Text set in it changes width slightly.
  
  Outline faces kern like a browser too. opentype.js skips GPOS extension
  lookups, which is where Inter keeps nearly all its kerning; the outline tier now
  reads pair kerning from GPOS itself.
- b228015: The text edit overlay no longer opens in the fallback font and then reflows. `@weasel-js/font` builds the overlay's DOM face as soon as the outline file's bytes are in hand: at `registerFontOutlines` for an `ArrayBuffer` source, and when the canvas first reads a URL or thunk source, reusing those bytes instead of fetching again. Registering a URL or thunk still fetches nothing. New `cssFontFamilyLoading(family, variant)` returns the load still in flight for the face `cssFontFamily` names, or `null` when there is nothing to wait for. An edit whose face is still loading keeps the overlay hidden until the face lands or for at most `fontHold` ms (new option on `useTextEdit` and `useSceneTextEdit`; default `TEXT_EDIT_FONT_HOLD`, 100ms), then shows the fallback. `0` restores the old behavior. Additive.
- 16a0476: Text runs carry a numeric weight. `StyledRun.fontWeight` (100–900) overrides the node's weight and the `bold` flag, which is now a preset over it: writing either one to a range drops the other. `numericWeight` and `isBoldWeight` (600 and up) are exported as the one reading of a weight.
  
  Taking bold off part of a bold node now writes `fontWeight: 400` over that part and leaves the node alone, instead of lowering the node and re-bolding the rest — so it works at any node weight, including 900, where it used to be refused. `SetFlagResult.applied` is gone, since the edit can no longer be declined. `effectiveRangeStyle` reports the `fontWeight` that renders and reads `bold` off it; `patchRangeStyle` lays an armed style over a range the way a write would.
  
  `listFontWeights(family)` in `@weasel-js/font` reports the weights a family has on the atlas and outline tiers. A new `font-weight` pref kind draws `FontWeightSelect`, which lists those weights (the nine CSS weights for a family with none on file) and reads the family from the `fontFamily` leaf beside it. The text tool's character options and the node panel's Weight field both use it. The overlay and SVG round-trip a run's weight; a tspan `font-weight` other than 700 now reads as the run's weight rather than being dropped.
- 4cb55b7: Text can be set in small caps. `StyledRun` and `TextStyle` take
  `fontVariantCaps: 'normal' | 'small-caps'`. A run overrides the node, and
  `'normal'` on a run turns off small caps it would inherit. Lowercase letters
  are drawn as capitals at a smaller size. The run's `text` is not rewritten, so
  carets, selections and hit tests address what was typed. The small-caps
  reading is applied after `textTransform`, as CSS does it.
  
  This is a synthesis, not the font's `smcp` feature. The small size is the
  face's x-height over its cap height (`smallCapsScaleFor`). A face that states
  neither height gets `SMALL_CAPS_SCALE`, 0.7, which is the factor Chromium and
  WebKit use. `FaceMetrics` gains `xHeight` and `capHeight`, read from `OS/2`
  on both tiers. The bundled Inter atlas carries them now.
  
  `ResolvedRun` gains an optional `sizeMap`, which holds the size each unit of
  its text is drawn at. `fontSize` still sets the line height and the rules, so
  a small-caps word keeps its line and gets one underline. The layout cache keys
  on the size map. The outline-tier size gate reads the run's size, so one word
  is never split across tiers.
  
  The edit overlay sets the lowercase letters of a small-caps run in
  `<span data-small-caps>` pieces. It sizes them at the canvas scale, because a
  browser's own synthesis uses a fixed factor. It re-splits the pieces as you
  type. A plain-text edit now commits the overlay's DOM text instead of
  `innerText`. `innerText` applies `text-transform`, so a node shown in capitals
  committed the capitals as its text. `@weasel-js/svg` writes
  `font-variant="small-caps"`, and `normal` on a tspan, and reads either back.
  
  All of this is additive.
- 09ff2c1: New `warmFonts(families?)`, additive: loads registered MSDF atlases ahead of their
  first use and resolves once they land, the font counterpart of `warmPaintKinds`.
  With no list it loads every family passed to `registerFont`, starting lazily
  declared variants and joining fetches already running. It rejects when a load
  fails, or for a family that was never registered.
  
  `renderSceneToPixels` and a `RasterSession` render synchronously, so text set in
  a face registered `{ lazy: true }` draws nothing until its atlas has been
  fetched — and nothing fetches it until text first asks. `await warmFonts()`
  before a headless render that contains text.
- 637945e: `warmRender` can load just what one render needs. Pass it the render,
  `warmRender({ render: args })` with the args `renderSceneToPixels` or
  `RasterSession.render` will take, or `{ commands }` already built. It builds
  the commands the way the render does and loads only the font faces their text
  is set in and the paint kinds they name. A capture no longer loads the mesh
  chunk when it draws no mesh, and no longer fails because some unrelated lazy
  font failed to load. It still rejects when a face the render needs fails.
  `families` and `paintKinds` still override, and `warmRender()` with no render
  still loads everything.
  
  labkit's raster capture and the RenderToPixels and DebugOverlay demos now warm
  only what they are about to render.
  
  Additive: core exports `renderNeeds(commands)`, which returns the fonts and
  paint kinds a command list draws with, and `debugSnapshotArgs(args)`, which
  returns the `renderSceneToPixels` args behind `renderDebugSnapshot`.
  `warmFonts` also takes a `FontRequest` (`{ family, weight?, style? }`, exported
  from `@weasel-js/font` and core). A request loads what resolving that one
  variant draws with: the exact variant, or the whole family when that variant
  was never registered, the substitute family when the policy would swap one in,
  and the variant's outline face. Unlike a bare family name, a request for a
  family nothing registered resolves instead of rejecting.
- @weasel-js/registry@1.7.1

## 1.7.0

### Patch Changes

- a028cc3: New package `@weasel-js/registry`: `createReflectable()` is a keyed store a registry embeds to hand out a uniform read-only `Reflection` — `get`, `has`, `entries()`, `subscribe` and `getVersion`, shaped for `useSyncExternalStore`. Each entry reports the registrant's `source` and the registrants it displaced (`shadowed`), so overrides of one key show up as conflicts.
  
  The kit's module-level registries now expose one: `paintKindRegistry`, `markerRegistry`, `opFactoryRegistry`, `fontRegistry`, `fontOutlineRegistry` (which also notifies as a face's load state moves), and, from `@weasel-js/core/renderer`, `programSourceRegistry` and `textureRegistry`. `ModeRegistry` gains `reflection`. Built-in paint kinds and markers report `source: 'kit'`.
  
  Fixes paint-kind and marker overrides disposed out of order: with two overrides of one id, disposing the earlier and then the later used to restore the already-disposed earlier one instead of the built-in. Overrides now stack, and each disposer removes only its own entry.
- Updated dependencies [a028cc3]
  - @weasel-js/registry@1.7.0

## 1.6.1

No changes in this release.

## 1.6.0

## 1.5.2

### Patch Changes

- 24a2dae: Close the places where two tiers spelled one concept differently.
  
  **A fixed pan bug.** `viewport.dragPan` fell back from `drag.screenDelta` to
  the world `drag.delta` and then divided by the zoom anyway, panning at
  1/scale² for any event source that supplies no `clientX`/`clientY` — which is
  every synthesized `InputEvent`, since those fields are optional. It now
  reconstructs the client delta exactly, by undoing each end of the world delta
  against the view that produced it.
  
  **Breaking, renames.** `ClickEvent`, `DoubleClickEvent` and `ContextMenuEvent`
  carry their world point as `x`/`y`, matching every other kind in `InputEvent`;
  `worldX`/`worldY` are gone, and a consumer who set `x`/`y` no longer silently
  lands at the origin. All three now also carry `clientX`/`clientY`, so a
  context-menu action can finally read `ctx.screen` — the case that surface was
  added for. The renderer's `Mat3` is `GlMat3`, freeing `Mat3` to mean geom's
  affine in a file that imports from both. `translatePolygonInPlace` is
  gone: it was the one sanctioned writer into a committed path's coord buffer,
  documented as overlay-only, and nothing called it. `@weasel-js/font` exports `FontStyle`
  in place of `OutlineFontStyle`. `@weasel-js/labkit` no longer exports
  `useOrbit`, `OrbitView`, `Vec3` or their helpers: `@weasel-js/kernel3d` owns
  the orbit camera and `@weasel-js/geom/3d` owns `Vec3`. `ToolCtx.screenPoint`
  was declared and never written by anything; it is gone.
  
  **Breaking, types narrowed.** geom's `Mat3` and `Box` are readonly tuples,
  matching the reason `geom/3d` already gives for its own. `History.entries()`
  returns `readonly` arrays, which is what its docstring always asked callers to
  assume.
  
  **One type where there were two.** `@weasel-js/svg`'s `Matrix` is geom's
  `Mat3`, and its duplicate `multiply` is geom's; `SvgStroke.width` is
  `ScreenLength` rather than that union written out again. `kernel3d`'s
  `ViewportRect` is `ScreenBox` — one rectangle spelling instead of `w`/`h`
  beside `width`/`height` eight lines apart. The renderer's `View` is routing's.
  Core's `Vec2` is routing's `Point2`, and `Pt` is gone from the barrel.
  
  **Additions.** `oklchDegToHex` / `hexToOklchDeg` / `OklchDeg` in
  `@weasel-js/paint` — the degrees-and-hex form `@weasel-js/ui` and
  `@weasel-js/theme` had each built for themselves. `srgbFloatToOklab`, for
  callers holding 0..1 floats; feeding those to `srgbU8ToOklab` truncated where
  paint's own internal conversion rounds. `mat3.toAffine` / `mat3.fromAffine`
  name the repack between the GL layout and geom's.
  
  **Corrections.** `RECT_POSE_DESCRIPTOR` implements `getRotation`, so a pose it
  rotated no longer reports itself unrotated to `useResize` and to diagram's port
  placement. `ToolDef.capabilities` is documented as reaching
  `Tool.eligibility.capabilities`, which is where it actually goes — following
  the old text gave `undefined`, and `eligibleForMode` turns that into a tool
  that vanishes from every mode. `MultitouchEvent.centroid` is documented as
  canvas-local, which is what the dispatcher hands over. `drag.points` is a
  snapshot on `onEnd` rather than the dispatcher's live accumulator.
  
  `tsconfig.json` now typechecks `packages/routing`, `cursor`, `bidi` and
  `loupe`, which it had never included.

## 1.5.1

## 1.5.0

## 1.4.4

### Patch Changes

- 4f8c6b2: Text no longer breaks a batched run. Glyphs, the rules under underlined words,
  and tessellated glyph outlines all stage into the same draw as the solid
  geometry and image quads around them, so a wall of captioned thumbnails is one
  draw where every label used to cost two.
  
  The batch shader carries the glyph math behind a paint mode, which packs into
  the texture-slot attribute the vertex already had, so the vertex does not grow
  and a wall of thumbnails costs what it did before. It runs that math on every
  fragment, glyph or not, because `fwidth` in non-uniform control flow is
  undefined and the derivative has to be taken before anything selects on the
  mode — priced at about 1.4% of a fragment that is not a glyph. A synthetic
  oblique now shears on the CPU as the batch places its corners, rather than in a
  vertex shader that read the baseline from a vertex attribute.
  
  Three things a run used to break on are gone: a second text color in the same
  paragraph, a decoration whose fill differs from the glyphs it sits under, and
  the difference between a baked MSDF atlas and a runtime canvas bake. What still
  breaks a run is a change of synthetic-bold threshold, which is a uniform — that
  one is a fallback path, since a registered bold face never sets it.
  
  **Breaking for anyone importing the text shader sources.** `TEXT_VERT_SRC`,
  `TEXT_FRAG_SRC`, `TEXT_FRAG_R8_SRC`, `TEXT_SDF_UNIFORMS` and
  `TEXT_SDF_ATTRIBUTES` are removed from `@weasel-js/font`: text has no program of
  its own any more. What replaces them is `GLYPH_COVERAGE_GLSL`, the snippet a
  program pastes in to turn an atlas sample into coverage, alongside
  `GLYPH_MODE_MSDF` and `GLYPH_MODE_R8` naming the two channel layouts.

## 1.4.3

## 1.4.2

## 1.4.1

## 1.4.0

## 1.3.0

### Patch Changes

- 9977908: Registering and unregistering outline faces advances the glyph generation
  
  `layoutRuns` records which tier each run resolved to, and `cachedLayoutRuns`
  holds that result until `glyphGeneration()` moves. The outline registry only
  advanced the counter when a face finished *loading*, so changing the set of
  registered faces left every cached layout intact:
  
  - `unregisterFontOutlines` dropped the slot, but text already laid out kept
    painting from outlines, with nothing left that could ever invalidate it —
    no load follows an unregister, so the counter never moved again.
  - `registerFontOutlines` was the mirror image. Text already cached on the SDF
    tier never re-ran layout, so it never asked for an outline glyph, so the
    face never began loading and its status sat at `idle` forever.
  
  Both now call `notifyGlyphReady`. An unregister that removes nothing does not,
  so `disableMachineFontOutlines` sweeping every weight/style pair still costs
  one invalidation per face it actually drops.
  
  This was latent until the layout cache gained a structural key. Before that
  it was keyed on run-array identity alone, and callers that rebuilt their runs
  each frame missed on every lookup and re-derived the tier by accident.

## 1.2.0

## 1.1.0

## 1.0.4

### Patch Changes

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

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

## 1.0.2

### Patch Changes

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

## 1.0.1

## 1.0.0

## 0.8.0

### Patch Changes

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

## 0.7.1

### Patch Changes

- 6af4806: `@weasel-js/font` gains `listCanvasFonts()`, the enumeration companion to
  `isCanvasFont`. Families served by the dynamic canvas-SDF tier could only be
  queried one at a time, so a font picker had no way to offer them without
  hard-coding a list beside the `registerCanvasFont` calls. Reports service
  rather than membership, matching `isCanvasFont`: an auto-enrolled family
  appears only while the `'canvas'` fallback policy is in force.

  `@weasel-js/ui`'s `Select` marks its portalled popover with
  `data-weasel-overlay`. A consumer asking "did focus leave my component?" via
  `closest()` gets the wrong answer for portalled DOM — a text editor whose
  font menu is a `Select` ended its edit session the moment the menu was
  clicked, discarding the style patch that click was making.

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
