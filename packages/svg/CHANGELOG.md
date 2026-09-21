# @weasel-js/svg

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
- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [ad6c351]
  - @weasel-js/core@1.5.2
  - @weasel-js/geom@1.5.2

## 1.5.1

### Patch Changes

- 894a52c: A conic gradient now survives an SVG round-trip. SVG has no element for one, so it serializes as a `<wzl:conicGradient>` def in `urn:weasel-js:svg` — declared on the root only when a document holds a paint that needs it — and parses back to the same fill. Previously the fill was omitted from `<defs>` with a warning and the `url(#id)` reference dangled, so the shape vanished in every viewer, weasel's own included.
  
  Every reference to a paint SVG cannot express now carries SVG's paint fallback after it (`fill="url(#grad0) #ff0000"`), taken from the paint kind's `colorOf`, or `none` when it has none. A registered kind writing its own `toSvg` gets that envelope without doing anything. On import, a fallback beside a reference this package cannot resolve — Inkscape's mesh gradients, say — is read as a flat fill instead of being dropped with a warning.
- 626bace: A gradient now names the space its stops blend through. `interpolate` on any of
  the three gradient kinds takes `'rgb'` (the default, and what every other vector
  format means by a gradient), `'oklab'`, or `'oklch'` — which travels around the
  hue wheel, so red to blue stays saturated instead of passing through a muddy
  purple. Alpha is linear in every space.
  
  The blend is paid for once, in the 256-texel ramp the shader samples, so a
  perceptual gradient costs a batched frame nothing over an sRGB one. The space is
  part of the ramp atlas key: the same stops under two spaces take two rows.
  
  `sampleGradientStops` and `sampleResolvedStops` take the space as a third
  argument, `bindRamp` as an optional third, and `GradientEditor` grows an
  sRGB / OKLab / OKLCh switch (`spaceSwitch={false}` hides it). `@weasel-js/svg`
  writes `wzl:interpolate` on the gradient's own element and reads it back; a
  renderer that ignores it still paints the gradient, in sRGB.
- 86be3eb: A sixth paint kind: `mesh-gradient`, PDF's shading types 6 and 7. A mesh is a
  set of curved quadrilateral patches, each carrying a color at every corner, so
  its color field bends where the three gradients can only run straight. Twelve
  control points make a Coons patch and sixteen a tensor patch, which is the only
  difference between them.
  
  It is registered through `registerPaintKind` rather than built into the
  renderer, so every slot it uses is one a consumer's own kind can use. The paint
  is rasterized once into a 256-texel bake the shader samples — forward, the way
  every renderer that draws these works, because a paint has to answer "what color
  is this fragment" and inverting a bicubic per fragment does not. Corner colors
  blend through `interpolate`, as a gradient's stops do.
  
  `@weasel-js/svg` writes it as `<wzl:meshGradient>` with every patch's points in
  full — not SVG's abandoned `<meshgradient>`, whose implicit edge sharing gives a
  reader a way to be quietly wrong — and reads it back. A renderer that skips the
  def paints the fallback color beside the reference.
  
  `MeshEditor` in `@weasel-js/ui` edits the corner colors and the blend space, and
  `PaintInput` renders it: before this, a mesh in that control fell through to the
  color field, which wrote a solid back over it.
- b981856: Accept `{ px }` screen-pixel sizes for `fontSize` and `letterSpacing`
  
  `TextStyle.fontSize`, `TextStyle.letterSpacing` and their `StyledRun`
  counterparts now take `number | { px: number }`, the spelling `Stroke.width`
  and `MarkerRef.size` already had. A `{ px }` size holds its on-screen size as
  the view zooms, so a label no longer divides by the view scale at the call
  site.
  
  The unit is one type and one resolver now: `ScreenLength` and
  `resolveScreenLength` live in `@weasel-js/paint`, which both core and text
  already depend on, and `resolveStrokeWidth` delegates to it.
  
  Resolution happens at the entry to layout, not at draw time. A screen-pixel
  size changes the glyph advances and so the wrap points and the measured
  bounds, so `resolveTextStyle`, `resolveRuns`, `textPoseLayoutInput`,
  `layoutTextPose`, `measureTextBounds` and the three command builders
  (`textCommand`, `textCommandFromRuns`, `textCommandFromPose`) each take the
  view scale, defaulting to 1. `ResolvedTextStyle` and `ResolvedRun` keep plain
  world numbers, so everything downstream is unchanged.
  
  `createTextLayer` passes the mean of `view.scale.x` and `view.scale.y`, so
  non-scene text gets this with no consumer change. The `kit:text` node painter
  deliberately does not: it memoizes on `(data, pose)` to keep the renderer's
  layout cache hitting across frames, and keying that on the live camera would
  miss on every zoom frame.
  
  SVG serialization writes a `{ px }` size as that many user units — SVG user
  space has no camera — and the fit clamp on import leaves one alone, since a
  screen-pinned size is not the file's to scale.
- d2b8390: `serializeSvg` now reports through `onWarn` what the document cannot carry the way weasel draws it, where it used to drop it silently: a stroke aligned `inner` or `outer` (SVG has no stroke alignment, so it is written centered), text that wraps at its box width (SVG text does not wrap), and text aligned to the center or bottom of its box (SVG text has no box). Weasel reads the last two back from their `data-weasel-*` attributes; other viewers draw them unwrapped and top-aligned. Each message is reported once per call. `SvgStroke` gains `align` so a bridge from a kit `Stroke` can pass it through and have the loss reported. Additive.
  
  labkit's annotation export passes a mark's stroke alignment through, so it is reported too.
- 0923159: `SvgGroupNode` carries a `clip` outline. `serializeSvg` writes it as a
  `<clipPath>` def plus `clip-path="url(#…)"` on the `<g>`, and `parseSvg` reads
  one back, baking it into the same space the group's children land in — SVG
  applies a group's `transform` to its clip as well, and parse collapses that
  transform onto descendants.
  
  A `<clipPath>` is no longer an unsupported element. One holding several shapes
  still is: SVG unions them and a `Path` is a single outline, so it warns and
  clips nothing rather than clipping wrongly. So does `clipPathUnits="objectBoundingBox"`.
- 20bd67b: An `<image>`'s source rect and flip now survive SVG. `SvgImageNode` gains `source` (the part of the bitmap to draw, as fractions of its width and height) and `flipX` / `flipY`. With any of them set, the serializer writes a `<g data-weasel-image>` around a nested `<svg>` viewport at the box, whose `viewBox` is the source window over a unit-square `<image>`, with the flip as a mirror about that window's center. That is plain SVG 1.1, so every viewer crops and mirrors it the way weasel draws it, and `parseSvg` reads the group back as one image node. An image with neither still writes a plain `<image>`. Additive.
- 5fbec37: `parseSvg` now reads a document's own `<marker>` when a stroke references one the marker registry has no entry for, instead of warning and dropping it. The new `ParseResult.markers` holds a `MarkerEntry` for each: its geometry and paint, `refX` / `refY` as the anchor, the viewBox, `markerWidth` / `markerHeight` and `markerUnits` folded into the size, and `orient` as the orientation (`context-stroke` reads as the line's own paint). Keys are the marker's id plus a hash of what it draws, so two files with the same id never collide, and the strokes in `nodes` name those keys. Nothing draws them until they are registered; `unpackSvgFiles` registers them itself. A reference the document does not define still warns and is dropped.
  
  A marker def written on export now keeps its entry's solid fill and outline colors and a fixed `orient`, where it used to write every marker as `context-stroke` pointing `auto`. It writes `orient="auto-start-reverse"` rather than `auto`, because weasel turns every start marker around, and a start arrowhead in another viewer used to point back into its line.
- cba02cc: A text node's vertical alignment now survives an SVG round-trip. `SvgTextNode` gains `verticalAlign`, written as `data-weasel-vertical-align` beside `data-weasel-width` / `data-weasel-height` and read back by `parseSvg`; `svgNodesToKitDrafts` carries it onto the `kit:text` leaf's `data.verticalAlign`. Previously an export dropped it and a re-import came back top-aligned. Other SVG readers still draw the text at the top of its box, since SVG text has no box to align within. Additive.
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [626bace]
- Updated dependencies [f4049be]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [b6a5eed]
- Updated dependencies [98ad39c]
- Updated dependencies [67f3867]
- Updated dependencies [f663199]
- Updated dependencies [a80e8db]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [d963d14]
- Updated dependencies [edb825a]
- Updated dependencies [229a16a]
- Updated dependencies [f9feecc]
- Updated dependencies [b981856]
- Updated dependencies [0662a2d]
- Updated dependencies [c0fa540]
- Updated dependencies [21ce23e]
- Updated dependencies [ff17dd7]
- Updated dependencies [f2b8d57]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/core@1.5.1
  - @weasel-js/geom@1.5.1

## 1.5.0

### Patch Changes

- 90f0bd8: Every 2D affine inversion now uses `@weasel-js/geom`'s `invert` and its singularity rule, which judges the determinant against the matrix's own scale.
  
  - SVG import now keeps a transform under a uniformly tiny parent scale, such as `scale(0.0000001)`. It used to call that parent singular and bake the child's rotation into the wrong space. A parent that really is singular now drops the child's transform with a warning, and so does a large parent whose determinant is only rounding. `@weasel-js/svg` now depends on `@weasel-js/geom`.
  - A gradient or pattern measured in `units: 'local'` or `'world'` now draws nothing when that space has no inverse, for example under a group that scales an axis to zero. It used to draw as if untransformed. `mat3.invert` returns `null` for such a matrix instead of the identity, and `PaintBindContext.spaceInverse` now returns `Mat3 | null`, so a registered paint kind should return `null` from `bind` when it gets `null`. Both are type-level breaking changes.
  - In the custom-shader vertex prelude, `v_world` now reads the world origin when the view has no inverse, instead of a scaled mapping that looked plausible and was wrong.
  - `useNodeOverlayFrame`'s `toLocal` now keeps the last mapping that had an inverse while a live view flattens an axis. It used to hand the overlay point back unchanged.
- 2adc840: `<text>` `x` now means what the SVG spec says it means: the `text-anchor`
  point. The serializer used to write the box's left edge beside
  `text-anchor="middle"` or `"end"`, so every other SVG reader drew centered text
  centered on that edge and right-aligned text ending at it. It now writes the
  box's center for `middle` and its right edge for `end` (the left edge for
  `start`), resolving `direction="rtl"` the same way the anchor itself does, and
  the parser converts the anchor point back to the box's left edge.
  
  **SVGs written by earlier versions import shifted.** Centered text in one of
  those files now lands half its box width to the left of where it was saved, and
  right-aligned text a whole box width to the left. Left-aligned text is
  unaffected. There is no detection of older files.
  
  **External SVG text now imports with a measured width.** A `<text>` with no
  `data-weasel-width` used to get a 99999-wide box; now that `kit:text` aligns
  within its box, centered or right-aligned imported text landed about 50000 or
  100000 units right of where the file drew it. The width now comes from the
  kit's text layout with the registered fonts, falling back to an estimate from
  the font size when no registered font can measure the text, and the box is
  placed so the text's anchor lands where the file put it.
  
  **`UNBOUNDED_TEXT_WIDTH` is removed** from the package's exports. The parser no
  longer produces it, so nothing has a sentinel left to check for.
- deb9e79: Text wraps only where its style says so, and everything that lays a text node
  out now agrees. `TextStyle.wrap` (default `false`) breaks lines between words
  at the pose width; without it a line runs as long as its text and the width
  only resolves `align`.
  
  Before this, `kit:text` never wrapped while `createTextLayer`, `textLineBoxes`,
  `caretIndexAt`, `fitTextPose` and the edit overlay all wrapped at the pose
  width. Opening an edit on a `kit:text` line longer than its box reflowed it,
  and a double-click could put the caret on a line the canvas never drew.
  
  **Breaking:**
  
  - `createTextLayer` and `fitTextPose` (`axis: 'height'`) no longer wrap unless
    the style sets `wrap: true`. Add it to text that should keep wrapping.
  - `TextLineBoxesOpts.maxWidth` and `caretIndexAt`'s `opts` argument are gone,
    along with the `CaretIndexAtOpts` type. Both read `style.wrap`.
  - The edit overlay is `white-space: pre` for unwrapped text, sized to its
    content, and never breaks inside a word in either mode.
  
  New: `layoutTextPose` and `textPoseLayoutInput` in `@weasel-js/text`, and
  `textCommandFromPose` in `@weasel-js/core`, which `kit:text` and
  `createTextLayer` both emit. `textLineBoxes` and `caretIndexAt` now resolve
  `align: 'start' | 'end'` against `direction` as the painters do, and
  `useSceneTextEdit` maps a double-click through the node's `verticalAlign`
  (`getVerticalAlign` for custom data), which it used to ignore. SVG export
  writes `data-weasel-wrap="true"` and import reads it back.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [dd48085]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [2f1ddd0]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [a41a83a]
- Updated dependencies [794b4ff]
- Updated dependencies [b65f4df]
- Updated dependencies [aa45d32]
- Updated dependencies [90f0bd8]
- Updated dependencies [b5b8b69]
- Updated dependencies [b2f2d45]
- Updated dependencies [6f5ff46]
- Updated dependencies [edd5b39]
- Updated dependencies [2e2041b]
- Updated dependencies [65806bc]
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
- Updated dependencies [269d432]
- Updated dependencies [486f631]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0
  - @weasel-js/geom@1.5.0

## 1.4.4

### Patch Changes

- acaa71d: A `{ px }` stroke width survives SVG export as `vector-effect="non-scaling-stroke"`.
  
  `{ px }` means "this thickness once rendered, whatever the view is doing".
  Serializing wrote its number as a plain `stroke-width`, which is a world-unit
  length — so a hairline exported from a zoomed-out view came back a slab, and a
  document had no way to say what the kit's own type says. SVG has the attribute
  for exactly this, and it needs no accumulated transform scale to resolve
  against.
  
  `SvgStroke.width` is now `number | { px: number }`, matching `Stroke.width`.
  Parsing reads `vector-effect="non-scaling-stroke"` off the element rather than
  the cascade, because SVG does not inherit it — a `<g>` carrying it does not
  hand it to its children.
- 4d48493: An unpacked `<text>` keeps its color.
  
  `svgNodesToKitDrafts` built a text leaf as `{ text, style }` and left `fill`,
  `stroke` and `runs` on the floor, so importing an SVG as native scene nodes
  dropped every glyph to the painter's default black and flattened per-`<tspan>`
  styling the parser had already read. All three now reach the leaf.
  
  A `userSpaceOnUse` gradient on a text node — or on one of its runs — is rebased
  onto the leaf's own box, the way a path's already was, so it survives the
  fit-clamp and the drop-point placement. A run carrying an absolute `fontSize`
  takes the fit-clamp scale alongside the node's.
- Updated dependencies [9ce6f00]
- Updated dependencies [6f876a7]
- Updated dependencies [ed400a3]
- Updated dependencies [fc00dae]
- Updated dependencies [730da55]
- Updated dependencies [60ba9d9]
- Updated dependencies [5732951]
- Updated dependencies [2ff4824]
- Updated dependencies [3d89141]
- Updated dependencies [4a128c4]
- Updated dependencies [aee9d92]
- Updated dependencies [c067221]
- Updated dependencies [26d40bf]
- Updated dependencies [b8d2940]
- Updated dependencies [b5e2cd9]
- Updated dependencies [89276ee]
- Updated dependencies [36950d8]
- Updated dependencies [4f8c6b2]
- Updated dependencies [1240956]
  - @weasel-js/core@1.4.4

## 1.4.3

### Patch Changes

- fc16cac: `Stroke.paint` is optional, and a stroke without one paints nothing everywhere
  rather than throwing.
  
  Such a stroke is real: a property panel that writes one field onto a node with
  no stroke — a width, a cap — materializes a whole stroke around it, and
  documents written before that was fixed still hold them. The painters already
  read one as no stroke. Every other reader dereferenced `paint` unguarded, so a
  document holding one threw on SVG export, on copy, and out of any consumer
  painter or overlay whose command reached the renderer directly.
  
  The type says so now, which is what stops the next reader from assuming
  otherwise. What each one does with an unpainted stroke:
  
  - The renderer skips the stroke pass and paints the fill.
  - The SVG serializer emits no `stroke` attributes at all, the way it already
    does for an absent or zero-width stroke.
  - Text layout keys it as no stroke, so an unpainted run groups with unstroked
    ones instead of splitting a draw call, and does not get pulled onto the
    outline tier to stroke nothing.
  - `setStrokeOpacity` seeds the default stroke color to have something to set an
    opacity on, keeping the width and joins already there.
- 995fde2: A text node's `data.fill: null` is now an explicit no-fill, so stroked-but-
  unfilled text — outline-only display type — renders as such.
  
  Every other node kind already read `null` that way. Text resolved it back to the
  default black, because a `ResolvedRun` had to name a concrete `FillStyle` and
  nothing downstream could skip the fill pass. `ResolvedRun.fill`,
  `ResolvedTextStyle.fill` and `LaidOutGroup.fill` are now `FillStyle | null`, and
  `TextPaint.fill: null` carries through to all three. Absent still means the
  default black.
  
  An unfilled run paints through its stroke alone, which only the outline tier can
  lay down, so layout emits no atlas quads for one and the renderer skips the
  glyph-fill mesh — an unfilled, unstroked run emits nothing at all, not even its
  outline geometry. Underline, strikethrough and overline follow the fill: a rule
  is a solid rect with no stroked counterpart, so an unfilled run draws none.
  Nothing changes for text that has a fill.
  
  Picking deliberately does not follow. `kit:text` still reports `filled: true`
  for `fill: null`, because a text node's silhouette is its line boxes rather than
  its glyph ink — reporting it unfilled would leave a word grabbable within a
  stroke width of a box edge and nowhere near the letters.
  
  `@weasel-js/svg` reads and writes SVG's own spelling of this: `<text
  fill="none">` parses to `fill: null` instead of being dropped as absent, and a
  text node with `fill: null` serializes as `fill="none"` rather than as SVG's
  default black. `SvgTextNode.fill` widens to `FillStyle | null`.
  
  The "Text outlines" demo has a Fill checkbox alongside its Stroke one; the two
  off together is a node with no glyph paint at all.
- Updated dependencies [2de5a37]
- Updated dependencies [10e1ab6]
- Updated dependencies [eb0d6ce]
- Updated dependencies [75969f6]
- Updated dependencies [0d40f94]
- Updated dependencies [713f98a]
- Updated dependencies [85f4a21]
- Updated dependencies [4bb0341]
- Updated dependencies [e0d5580]
- Updated dependencies [edf99d5]
- Updated dependencies [2723cc7]
- Updated dependencies [0ca0aca]
- Updated dependencies [3583ca3]
- Updated dependencies [fc16cac]
- Updated dependencies [6d4bbeb]
- Updated dependencies [995fde2]
- Updated dependencies [6e4fb4d]
- Updated dependencies [b0fba6a]
  - @weasel-js/core@1.4.3

## 1.4.2

### Patch Changes

- Updated dependencies [bfb0595]
- Updated dependencies [3b07b13]
- Updated dependencies [8e9eb1d]
  - @weasel-js/core@1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [dcef92c]
- Updated dependencies [73039aa]
- Updated dependencies [b91a8dd]
- Updated dependencies [caad52f]
- Updated dependencies [0b0f13f]
- Updated dependencies [00af9ac]
- Updated dependencies [9b9224c]
  - @weasel-js/core@1.4.1

## 1.4.0

### Patch Changes

- 1b9575f: Keep a `baseline-shift` named on `<text>` itself.
  
  SVG allows `baseline-shift` on a `<text>` element and inherits it to the
  content, but weasel only read it off `<tspan>` children — so
  `<text baseline-shift="super">hi</text>` imported with the shift silently
  dropped. Bare text now carries the shift its `<text>` names, and a `<tspan>`
  naming its own still wins.
  
  It is the only run-level key with no node-level counterpart to be read into,
  which is why it alone went missing.
- Updated dependencies [eb16573]
- Updated dependencies [6650d67]
- Updated dependencies [04ea2e8]
- Updated dependencies [b656ebf]
- Updated dependencies [1214ff5]
- Updated dependencies [5295c34]
- Updated dependencies [2fbf611]
- Updated dependencies [36b6ee7]
- Updated dependencies [7a0c568]
- Updated dependencies [a7fa697]
- Updated dependencies [2272682]
- Updated dependencies [503b56d]
- Updated dependencies [ac2deea]
- Updated dependencies [23ffb2f]
- Updated dependencies [016851c]
- Updated dependencies [c9dd37f]
- Updated dependencies [9a000ea]
- Updated dependencies [016851c]
- Updated dependencies [8ddec11]
- Updated dependencies [28894b9]
- Updated dependencies [c4ccd0a]
  - @weasel-js/core@1.4.0

## 1.3.0

### Patch Changes

- 52c7b2a: Depend on `font` and `core` as exact peers
  
  `@weasel-js/font` and `@weasel-js/core` keep registries that consumer code
  writes into — registered faces and glyph-ready subscribers in one, content
  handlers and paint kinds and shape painters in the other. Two physical copies
  in a tree are two registries, so a face registered into one while layout
  resolves against the other lays out nothing and the canvas is blank.
  
  Exact sibling pins are what produced the duplicate: a consumer mixing two
  weasel releases left npm no choice but to nest a second copy, silently. As
  peers, the same mix is an `ERESOLVE` at install time. `font` is now a peer of
  `core`, `hud` and `text`; `core` is now a peer of `svg`, joining `d3`, `hud`
  and `ui`, whose `>=` ranges tighten to exact so no version mix resolves by
  accident.
  
  **This can break an install that currently succeeds.** Anyone resolving a
  mixed set of weasel versions by luck now gets an install error instead of a
  blank canvas. That is the point, but it is a break.
  
  `labkit` deliberately keeps `core` as an ordinary dependency: its build aliases
  every core entry point to core's built files and inlines them, so it never
  resolves core at the consumer and has nothing to peer. The flip side is that
  labkit ships its own copy of core's registries, so a consumer using both still
  has two — this change does not address that.
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
  carries the preset's *size* as well as its rise, so a run that overrode only
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
- Updated dependencies [52c7b2a]
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
  - @weasel-js/core@1.3.0

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
