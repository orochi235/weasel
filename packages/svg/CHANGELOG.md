# @weasel-js/svg

## 2.0.0-pre.0

### Patch Changes

- 2ea772f: The canvas and the gradient editor now sample one gradient

  `buildGradientRamp` carried its own interpolation beside
  `sampleGradientStops`, and the two disagreed three ways: the ramp had no guard
  at either end and extrapolated past the first and last stop, the two picked
  opposite sides of a coincident pair, and they parsed color differently — a stop
  written as a CSS named color rendered on the canvas and threw in the editor.

  `sampleGradientStops` keeps its semantics and is now the only implementation.
  `resolveGradientStops` sorts and parses the list once; `sampleResolvedStops`
  returns the color at `t`. The ramp cache builds its texels through those, so
  there is no interpolation math left in the renderer.

  Two behavior changes worth naming. `resolveColor` is the surviving parser, so
  gradient stops accept named and functional colors everywhere — but no longer
  hex without a leading `#`, which only the editor path had tolerated and the
  canvas never accepted. And `sampleGradientStops` returns normalized hex at the
  endpoints instead of echoing the raw stop string, so `'red'` comes back as
  `'#ff0000'`.

  **SVG export:** a conic gradient left the exporter as a dangling `url(#…)` —
  the element already carried the reference, the built-in serializer returned
  nothing, and the registry's `toSvg` slot has no in-repo implementation, so the
  shape disappeared in a browser with no warning at all. Serialization now falls
  through to the same warning the pattern path already emits when nothing can
  produce a paint server. A consumer that registers a `toSvg` for
  `conic-gradient` still serializes and gets no warning.

- 50bc909: `FillStyle` is open: register a sixth paint kind and it renders, converts
  frames and serializes.

  `registerPaintKind(entry)` returns a disposer and `_resetPaintKindsForTests`
  re-seeds the five built-ins, matching the kit's other module-global
  registries. An entry carries the editor's slots (`label`, `seed`, `colorOf`,
  `Editor`), a render slot, both frame-conversion directions, and an SVG
  `<defs>` slot. `listPaintKinds()` enumerates them, and `asPaint` types a
  consumer's own paint as a `FillStyle` — the union itself stays closed, because
  opening its discriminant would widen every built-in member.

  Three defects fall out of the same change, each of which a sixth kind hit
  immediately. The renderer's fill dispatch fell off the end of its switch into
  an unguarded cast to the gradient union, so an unknown kind read `stops` off a
  paint with none and threw mid-frame. `fillInPoseFrame` and its inverse returned
  an unknown kind untouched, leaving it painting in screen space on a node that
  moves. `<defs>` emitted nothing for a kind `gradientXml` did not know while
  still writing the `url(#id)` that referenced it.

  Registering a kind now bumps the node memo generation, so a node painted
  before the registration repaints rather than holding the frame it resolved
  when the kind was unknown.

- 6a06f6d: Node paint is an object: `data.fill` is a `FillStyle`, `data.stroke` a `Stroke`

  Each concept now has exactly one shape. `data.fill` holds a `FillStyle`,
  `data.stroke` a whole `Stroke`, and `null` on either is an explicit "no paint"
  where `undefined` takes the painter's fallback. Two new authoring helpers keep
  hand-written node data short:

  ```ts
  data: { path, fill: solid('#7fb069'), stroke: strokeOf('#1c1c1c', 2) }
  ```

  **Breaking, with no compatibility path.** A document written against the old
  shapes renders wrong rather than failing, which is accepted:

  - `NodeFill = string | FillStyle` and `NodeStroke = string | Stroke` are gone,
    and so are the string branches of `resolveNodeFill` / `resolveNodeStroke`.
    A node holding `fill: '#f00'` now paints the default grey.
  - `data.strokeWidth` is deleted. A stroke's width is `Stroke.width`.
  - `data.color` — the legacy alias `kit:path` and the rect fallback read — is
    deleted. The fallback painter reads `data.fill` like everything else.
  - `fill: 'none'` is now `fill: null`; `stroke: 'none'` is `stroke: null`.
  - `NodeInkResult` is gone: a painter's `ink` returns `NodeInk` and nothing
    else. A painter returning `{ filled, strokeWidth }` no longer type-checks
    and its reach is read as zero.
  - `@weasel-js/ui` drops `isStrokeObject`, which existed only to discriminate
    the union; `strokeColorOf` and `strokeWithColor` lose their string branches.
  - `@weasel-js/svg`'s `strokeDataFromSvg` returns `Stroke | undefined` instead
    of a `{ stroke, strokeWidth }` pair, and stops flattening a plain solid
    stroke into a color. SVG's `fill="none"` imports as `fill: null`.

  **A paint's alpha lives in `opacity`, one slot for every paint kind.** That is
  the only slot a gradient or a pattern has, so it is the slot all of them use,
  and the renderer multiplies a hex alpha by it — the two would fight if both
  carried the value. `solid()` therefore moves an alpha channel out of the hex:
  `solid('#ff000080')` is `{ color: '#ff0000', opacity: 0.502 }`.

  The four setter actions follow: `setFillOpacity` / `setStrokeOpacity` write
  `opacity` rather than splicing hex, so they now work on a gradient fill, which
  they used to leave untouched. `setFill` / `setStroke` given a `color` recolor
  the node's existing paint through the new `paintWithColor`, keeping its opacity
  unless the picked color states an alpha of its own — and `setStroke` keeps the
  stroke's width, cap, join and dash instead of replacing the whole value.

  New exports: `solid`, `strokeOf`, `paintAlpha`, `paintWithAlpha`,
  `paintWithColor`, `DEFAULT_SHAPE_FILL`.

  `defaultNodeProperties` moves `data.fill` from a `color` leaf to a `paint` one
  — a color control pointed at a `FillStyle` reads `undefined` off a gradient and
  writes a bare string over it — and the `data.stroke` object leaf drops its
  `fromScalar`, which had nothing left to lift.

- 94f2446: Add stroke markers — arrowheads and other line terminators as stroke style.

  `markerStart` / `markerMid` / `markerEnd` on `Stroke` take a key resolved
  through a new registry (`registerMarker`), shipping eight built-in shapes.
  Unlike SVG, the stroke stops short of a filled head rather than running under
  it to the tip; the distance is declared per marker, so an open V still reaches
  the vertex. Round-trips through `@weasel-js/svg` as `marker-*` attributes plus
  `<marker>` defs.

- 2b2d971: Keep a stroke's dash, cap, join and gradient paint through SVG import

  `unpack` lowered every stroke to a color string plus a width, because that was
  all `data.stroke` could hold — a gradient stroke became `#888888` with a
  warning, and dashes, caps, joins and miter limits were dropped silently. Now
  that `data.stroke` is `NodeStroke = string | Stroke`, the whole `SvgStroke`
  comes through.

  A plain solid stroke still arrives as the color-string pair every consumer
  already reads. Anything the pair cannot express — a gradient paint, a dash, a
  cap, a join, a miter limit, a `stroke-opacity` — arrives as the object form,
  with the paint normalized to the leaf's own box exactly as a gradient fill is,
  so a `userSpaceOnUse` gradient survives the fit-clamp and the drop placement.

  `strokeDataFromSvg` is exported, so a second importer lowering SVG onto kit
  nodes doesn't have to re-derive which form to write.

- 00c5203: Round-trip overline, superscript and relative run sizes

  `<tspan>` now carries the four run fields added alongside superscript support,
  in SVG's own vocabulary rather than a weasel-specific one: `text-decoration`
  gains the `overline` token it previously parsed and dropped, `script` becomes
  `baseline-shift="super"` / `"sub"`, a raw `baselineShift` becomes a
  `baseline-shift` percentage, and `fontScale` becomes a percentage `font-size`.
  Both percentages resolve against the parent in SVG, which is the unit the run
  fields are already in.

  One case normalizes rather than round-tripping exactly. `baseline-shift="super"`
  carries the preset's _size_ as well as its rise, so a run that overrode only
  the rise has no keyword left to say the size with; it serializes as the two
  primitives the preset stood for and parses back that way. Same rendering,
  different fields — without it the superscript came back full-size at a raised
  baseline.

- c1b8511: **Breaking:** paint leaves `TextStyle`. A text node's color and outline are
  `data.fill` and `data.stroke` — the same two leaves every other node kind
  paints from — and `TextStyle` holds typography only. `TextStyle.fill` and
  `TextStyle.stroke` are gone, with no compatibility read: a document that put
  its color in `style.fill` now renders in the default black rather than
  erroring, so check documents that predate this.

  This fixes a real asymmetry rather than only moving fields. `data.stroke`
  already reached text through a fold in the painter, but `data.fill` did not:
  picking a fill color with a text node selected wrote a field nothing read, so
  the canvas did not change. `setFill`, `setFillOpacity`, the opacity scrub and
  the Appearance leaf now all mean the same thing on text as on a rect. The
  duplicate `data.style.fill` control is gone from the text schema with them.

  `resolveTextStyle(style, paint)` takes the node's paint as a second argument
  and is what derives the caret and selection colors, so the edit overlay
  matches the glyphs it sits on; `useTextEdit` gained a `getPaint` option for
  the same reason, defaulted by `useSceneTextEdit` from `data.fill` /
  `data.stroke`. `TextPose` gained `fill` / `stroke`, so text drawn through
  `createTextLayer` is painted rather than black. `SvgTextNode` gained the same
  two, and SVG import and export carry text paint there instead of inside the
  style. `StyledRun.fill` and `.stroke` are unchanged and still override the
  node's per range — which is also where a caller with no node at all, a HUD
  widget or a debug overlay, now states its color.

  `textCommandFromRuns` is exported from the package root.

- c2ffa49: Alignment can resolve against reading direction

  `align` gains `start` and `end` alongside `left` / `center` / `right`, and
  `TextStyle` gains `direction: 'ltr' | 'rtl'`. The split is CSS `text-align`'s:
  the relative pair resolves against the direction, the absolute pair ignores it.
  `resolveAlign(align, direction)` collapses one to the other and is exported for
  consumers that need an edge rather than an intent.

  Direction is an input, not something this package discovers. `@weasel-js/text`
  has no DOM, so a consumer that reads `getComputedStyle(box).direction` passes
  what it found; nothing here sniffs an environment.

  Defaults are unchanged — `align: 'left'`, `direction: 'ltr'` — so no existing
  layout moves. Making `start` the default alignment is a separate call.

  `@weasel-js/svg` carries the direction through: `direction` joins the
  inheritable presentation properties, and `text-anchor` is now written and read
  against it. Two things were wrong before and are worth naming, because both
  rendered plausible output:

  - `align: 'start'` serialized to `text-anchor="end"` — the opposite edge — via
    a mapping that assumed three values and read the fourth as its `else`.
  - SVG's initial `text-anchor` is `start`, which under `direction="rtl"` is the
    right edge, while this model's default `align` is `left`. They agree under
    `ltr` and only there, so an RTL document with no explicit anchor imported as
    left-aligned.

  This is alignment and round-tripping only. Layout still walks code points in
  logical order with the pen always increasing: there is no bidi reordering and
  no shaping, so a Hebrew or Arabic string aligns to the correct edge and still
  renders in logical order, and Arabic still renders unjoined.

- Updated dependencies [3386d64]
- Updated dependencies [ffafb7d]
- Updated dependencies [ba8b139]
- Updated dependencies [3fb3a46]
- Updated dependencies [67bcb05]
- Updated dependencies [47cbb08]
- Updated dependencies [f43e9c2]
- Updated dependencies [bb27e83]
- Updated dependencies [6a33c3f]
- Updated dependencies [c24e7de]
- Updated dependencies [ce82f4a]
- Updated dependencies [be697dc]
- Updated dependencies [e909a3b]
- Updated dependencies [26bbdcf]
- Updated dependencies [546f67d]
- Updated dependencies [3fb3a46]
- Updated dependencies [ccd51cc]
- Updated dependencies [3fb3a46]
- Updated dependencies [d9f110e]
- Updated dependencies [0dd35a1]
- Updated dependencies [1a0bea3]
- Updated dependencies [9d95836]
- Updated dependencies [62a3c46]
- Updated dependencies [5f6c28e]
- Updated dependencies [3cd1ee8]
- Updated dependencies [2ea772f]
- Updated dependencies [f77bd95]
- Updated dependencies [2ea772f]
- Updated dependencies [aba8d91]
- Updated dependencies [2ea772f]
- Updated dependencies [3386d64]
- Updated dependencies [68d2651]
- Updated dependencies [3386d64]
- Updated dependencies [c6c499d]
- Updated dependencies [4f1ef0b]
- Updated dependencies [0114abf]
- Updated dependencies [50bc909]
- Updated dependencies [6a06f6d]
- Updated dependencies [a37ee0b]
- Updated dependencies [611b30e]
- Updated dependencies [9ad8cb2]
- Updated dependencies [c1b8511]
- Updated dependencies [d793d3c]
- Updated dependencies [3386d64]
- Updated dependencies [ce2b5c7]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
- Updated dependencies [84db1f6]
- Updated dependencies [3386d64]
- Updated dependencies [7a746df]
- Updated dependencies [4f19274]
- Updated dependencies [94f2446]
- Updated dependencies [07fd2de]
- Updated dependencies [81213fc]
- Updated dependencies [2f225d7]
- Updated dependencies [68069dc]
- Updated dependencies [5d0ff9c]
- Updated dependencies [c1b8511]
- Updated dependencies [546f67d]
- Updated dependencies [c2ffa49]
- Updated dependencies [4c097ef]
- Updated dependencies [2b86e00]
- Updated dependencies [d933a89]
- Updated dependencies [bca99e3]
- Updated dependencies [5923c8b]
- Updated dependencies [2ea772f]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
  - @weasel-js/core@2.0.0-pre.0

## 1.2.0

### Patch Changes

- Updated dependencies [53016f7]
- Updated dependencies [e25e77b]
- Updated dependencies [8e00c13]
- Updated dependencies [c91e186]
- Updated dependencies [cada4da]
- Updated dependencies [889b1d0]
- Updated dependencies [9e6927a]
- Updated dependencies [eafe4be]
- Updated dependencies [ae84ca1]
- Updated dependencies [0514a37]
- Updated dependencies [daa5ce6]
- Updated dependencies [144e70a]
- Updated dependencies [2627cde]
- Updated dependencies [8b583b4]
- Updated dependencies [e61d3e3]
- Updated dependencies [f0cc29c]
- Updated dependencies [438970b]
- Updated dependencies [f2ba2ab]
- Updated dependencies [4ac9273]
- Updated dependencies [8570a23]
- Updated dependencies [7c202d2]
- Updated dependencies [c7b4705]
- Updated dependencies [6a5c047]
- Updated dependencies [49e450c]
- Updated dependencies [6031085]
- Updated dependencies [ccaaecd]
- Updated dependencies [ec0eb08]
- Updated dependencies [726f85e]
- Updated dependencies [601aa6b]
- Updated dependencies [9607185]
- Updated dependencies [58f43e7]
- Updated dependencies [2e22d99]
  - @weasel-js/core@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [27dd91b]
- Updated dependencies [0763205]
- Updated dependencies [b65aadd]
- Updated dependencies [0c13967]
- Updated dependencies [83ba8b0]
  - @weasel-js/core@1.1.0

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

- Updated dependencies [da7c150]
- Updated dependencies [f7df982]
- Updated dependencies [85be764]
- Updated dependencies [a3db906]
- Updated dependencies [12303bc]
- Updated dependencies [d36953e]
  - @weasel-js/core@1.0.4

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

- Updated dependencies [5d25a40]
- Updated dependencies [f7077f6]
- Updated dependencies [514c34a]
  - @weasel-js/core@1.0.3

## 1.0.2

### Patch Changes

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

- Updated dependencies [28710f2]
- Updated dependencies [2e3fea2]
- Updated dependencies [75ba7b1]
- Updated dependencies [e4a6ec4]
- Updated dependencies [d2a9049]
- Updated dependencies [5f05431]
- Updated dependencies [5fea43d]
- Updated dependencies [443d74e]
- Updated dependencies [7decec1]
- Updated dependencies [24daa08]
- Updated dependencies [f79e4b2]
  - @weasel-js/core@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [d6c2eff]
- Updated dependencies [d62dc17]
- Updated dependencies [2604ce2]
- Updated dependencies [24ae9f4]
- Updated dependencies [c2ebfdf]
- Updated dependencies [dce3306]
- Updated dependencies [69395b0]
- Updated dependencies [3d93f2e]
- Updated dependencies [e367165]
- Updated dependencies [52e9c57]
- Updated dependencies [d68e734]
- Updated dependencies [ca9673a]
- Updated dependencies [fa1ed05]
- Updated dependencies [0a40c29]
  - @weasel-js/core@1.0.1

## 1.0.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [ffd9713]
- Updated dependencies [8853e73]
- Updated dependencies [43482ce]
- Updated dependencies [9ed1139]
- Updated dependencies [6aaa469]
- Updated dependencies [40dd97d]
- Updated dependencies [531150f]
- Updated dependencies [596253e]
- Updated dependencies [22eafe6]
- Updated dependencies [cd23624]
  - @weasel-js/core@1.0.0

## 0.8.0

### Minor Changes

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

- Updated dependencies [bdcdfe5]
- Updated dependencies [e0ab60e]
- Updated dependencies [3d693c7]
- Updated dependencies [e264d62]
  - @weasel-js/core@0.8.0

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

- Updated dependencies [8bc719a]
- Updated dependencies [a19124d]
  - @weasel-js/core@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies [a3af158]
- Updated dependencies [a3af158]
- Updated dependencies [6af4806]
- Updated dependencies [a3af158]
- Updated dependencies [2003597]
  - @weasel-js/core@0.7.1

## 0.7.0

### Minor Changes

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
- Updated dependencies [e7d71c9]
  - @weasel-js/core@0.7.0

## 0.6.0

### Patch Changes

- @weasel-js/core@0.6.0

## 0.5.1

### Patch Changes

- @weasel-js/core@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies [7e1982f]
  - @weasel-js/core@0.5.0
