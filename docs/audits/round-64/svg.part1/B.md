**Findings file:** I couldn't write `.skulkr/out/findings.md` because write permission was denied, so the whole document follows. The commit the brief names (49e5a07e) isn't in this repository. I read at HEAD `6f634fabe1`, where `packages/svg` has no local changes.

# Audit round 64: svg.part1 findings

## A `<text>` run with no stroke of its own loses the node's inner or outer stroke when exported
- where: packages/svg/src/alignedTextStroke.ts:66 (`repainted`, with `strokeFor` at :56)
- scenario: A text node has `stroke: { align: 'outer', width: 2 }` and `runs: [{ text: 'a', stroke: {...inner} }, { text: 'b' }]`. Run `b` has no stroke, so it takes the node's outer stroke. In the outer copy, `repainted` calls `strokeFor(r.stroke, 'outer')` with `undefined`. `alignOf(undefined)` is `null`, so `strokeFor` returns `null`, and the run is written with `stroke="none"`. The main `<text>` writes that stroke at `stroke-width="0"`. As a result, glyph `b` is drawn with no outer stroke in any SVG viewer. Run `b` should keep its stroke unset in the copy (inheriting the doubled node stroke), not get `none`. The existing test at alignedTextStroke.test.ts:57 only checks the parse round-trip, not what gets drawn.
- evidence: read
- severity: medium

## `fill-opacity` on an element does not count as setting its fill, but `stroke-opacity` does count for the stroke
- where: packages/svg/src/groupPaint.ts:24 (`setsFill`)
- scenario: Input `<g fill="red"><rect fill-opacity="0.5" .../></g>`. `inheritsFrom` marks the rect `inherits.fill = true` even though its own fill is red at 0.5.
  - On export, `fitLeafXml` drops every fill attribute from it, `fill-opacity` included, because `FILL_ATTRS` contains `fill-opacity`. The rect is then drawn fully opaque.
  - On import, `takesOf` turns its fill into `'inherit'`, which is the group's red at full opacity.
  - A `<g fill-opacity>` nested under a filled `<g>` has the same problem through `groupPaint`/`groupTakes`.
  - The stroke side does it correctly: `STROKE_PROPS` includes `stroke-opacity`. So does the tspan reader: readRuns.ts:125 tests `setsOwn(el,'fill') || setsOwn(el,'fill-opacity')`. That is the same decision answered two ways.
- evidence: read
- severity: medium

## A `<use>` that sets its own paint is read as taking the paint of the group around it
- where: packages/svg/src/parse.ts:225 (`parseElement`, the `use` branch)
- scenario: Input `<g fill="red"><use href="#r" fill="blue"/></g>`, where `#r` is a rect with no fill. The target is read with the outer `from` (`{fill: true}`), so the rect is marked `inherits.fill = true` even though its resolved fill is blue.
  - Export drops its fill attributes, so it draws red.
  - `svgNodesToKitDrafts` makes it `'inherit'`, so it also comes out red.
  - A nested `<svg>` already handles this case with `viewportPaintFrom(el, from)` (parse.ts:248). The `use` path needs the same thing, because a paint the `<use>` sets belongs to no group.
- evidence: read
- severity: medium

## `opacity` and `clip-path` on a `<use>` are dropped without a warning
- where: packages/svg/src/parse.ts:225 (`parseElement`); use.ts never reads either property
- scenario: `<use href="#r" opacity="0.5"/>` draws its target fully opaque. `<use href="#r" clip-path="url(#c)"/>` draws it unclipped, with no warning.
  - The `use` branch returns before the `clip-path` check at :227, which at least warns for other tags.
  - Nothing reads `ownValue(el, 'opacity')` for a `<use>`. By contrast, `<g>`, a nested `<svg>` (fixed in 7124255feb) and leaves all keep their opacity.
- evidence: read
- severity: medium

## A custom painter's `'world'` pattern paint is written in the pose's frame without being mapped back
- where: packages/svg/src/painterLeaf.ts:110 (`paintIn`)
- scenario: A `registerNodeShape` painter returns a path command whose fill is a hatch, image or texture pattern with `units: 'world'`, on a node with a rotation or `transform`.
  - `svgFromPainter` wraps the commands in `<g transform=frame>`.
  - `paintIn` only maps paints through `invert(toDoc)` when they are in `GRADIENTS` (linear, radial, conic). A pattern is returned unchanged, so its world `origin` and `transform` are read in the turned frame, and the tile is offset and rotated away from where the canvas draws it.
  - `fillThroughMatrix` already handles patterns (paintThroughMatrix.ts:33). Only the `GRADIENTS` guard keeps them out.
- evidence: read (`PatternPlacement.units` admits `'world'`, packages/paint/src/patternPaint.ts:25)
- severity: medium

## `visibility="hidden"` on a `<use>` or a `<text>` drops descendants that turn themselves back on
- where: packages/svg/src/parse.ts:368 (`isHiddenElement`)
- scenario: Input `<use href="#g" visibility="hidden"/>`, where `#g` holds `<rect visibility="visible"/>`. Another case is `<text visibility="hidden"><tspan visibility="visible">x</tspan></text>`. Both are dropped whole when `keepHidden` is off, but SVG draws the visible descendant.
  - The function's own comment says an inherited `visibility` can't be decided on a container. It exempts `g`/`svg`/`a`/`switch`, but `use` (whose target may be a `<g>` or `<symbol>`) and `text` are judged as leaves.
- evidence: read
- severity: low

## `scaleStroke` leaves a stroke with no `width` at 1 while scaling its dashes and heads
- where: packages/svg/src/metricScale.ts:50 (`scaleStroke`)
- scenario: A kit `Stroke` with `width` omitted (which means 1, as `coreStrokeAttrs` and `alignedTextStroke` read it) has `dash: [4, 2]`. Taking it through a fit-clamped import or a baked scale of 2 (`unpackFiles.ts:40`, `strokeThroughMatrix`) gives `dash: [8, 4]`, but `width` stays undefined, so the stroke is still 1 wide instead of 2. `if (width !== undefined)` skips the default.
- evidence: read
- severity: low

## Files read
packages/svg/src/__fixtures__/fixtures.ts
packages/svg/src/absoluteUnits.ts
packages/svg/src/alignedTextStroke.ts
packages/svg/src/bakeTransforms.ts
packages/svg/src/bitmapHref.ts
packages/svg/src/booleanGroup.ts
packages/svg/src/cascade.ts
packages/svg/src/color.ts
packages/svg/src/condition.ts
packages/svg/src/conditional.ts
packages/svg/src/container.ts
packages/svg/src/cssScan.ts
packages/svg/src/draftPose.ts
packages/svg/src/draftSpecs.ts
packages/svg/src/draftTakes.ts
packages/svg/src/elements.ts
packages/svg/src/fadePaint.ts
packages/svg/src/fillPaint.ts
packages/svg/src/fontSize.ts
packages/svg/src/framedText.ts
packages/svg/src/fromKit.ts
packages/svg/src/glyphRises.ts
packages/svg/src/glyphShifts.ts
packages/svg/src/glyphTurns.ts
packages/svg/src/gradientStops.ts
packages/svg/src/gradients.ts
packages/svg/src/groupBox.ts
packages/svg/src/groupPaint.ts
packages/svg/src/groupPaintXml.ts
packages/svg/src/hugeStrokeBounds.bench.ts
packages/svg/src/index.ts
packages/svg/src/kitInherits.ts
packages/svg/src/kitPaint.ts
packages/svg/src/laidLines.ts
packages/svg/src/lengths.ts
packages/svg/src/lowerLeaf.ts
packages/svg/src/markerDefs.ts
packages/svg/src/media.ts
packages/svg/src/metaXml.ts
packages/svg/src/metricScale.ts
packages/svg/src/openSubpathFill.ts
packages/svg/src/paintServers.ts
packages/svg/src/paintThroughMatrix.ts
packages/svg/src/painterLeaf.ts
packages/svg/src/parse.ts

<!-- done: 7 findings, files read: 45 -->