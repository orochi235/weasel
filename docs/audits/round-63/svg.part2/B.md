# Audit round 63 — area `svg.part2` findings

Note: commit 1b4edb3a93db1759496d564da57eb13020b3d7d2 is not in this repository; the tree read is HEAD
6f634fabe1 (`packages/svg` has no local changes there).

## A document's own `<marker>` is ignored whenever its id matches a kit marker key
- where: packages/svg/src/readMarkers.ts:71 (ingestMarkers → resolve)
- scenario: a foreign SVG defines `<marker id="arrow">` holding, say, a circle, and a path has
  `marker-end="url(#arrow)"`. `getMarker('arrow')` answers the kit's built-in arrow, so `resolve` hits `continue`
  before it looks at `defs`, and the path ends in the kit's arrowhead instead of the document's circle. The id-to-kit
  shortcut should only apply to a def this package wrote (one carrying `wzl:key`, or no document def at all), not to
  any document def that happens to share a kit key name ("arrow", "dot" and the like are common hand-written ids).
- evidence: read
- severity: medium

## An image pattern's `patternTransform` parse warnings are dropped
- where: packages/svg/src/patterns.ts:142 (readImagePattern)
- scenario: `<pattern patternUnits="userSpaceOnUse" patternTransform="skewQ(3)">` holding one `<image>` →
  `readPlacement(el)` is called without `onWarn`, so `parseTransform`'s warning about the unreadable transform never
  reaches the caller, while the same attribute on a tile pattern (line 112 passes `onWarn`) warns. The two read paths
  answer one question two ways.
- evidence: read
- severity: low

## Negative `stroke-width` and `font-size` are kept instead of being invalid declarations
- where: packages/svg/src/properties.ts:271, :282 (PROPERTIES `stroke-width`, `font-size`; no `invalid`)
- scenario: `<g stroke-width="4"><path style="stroke-width:-2" …/></g>` → CSS rejects a negative `stroke-width`
  at parse time, so the inherited 4 stands in a browser; here `worldLength` returns -2 and, with no `invalid`
  predicate, `isDeclarationInvalid` says false, so the cascade keeps -2 and `readStroke` builds a stroke of width -2.
  Same for `font-size:-5px` (readFontSize returns `{ fontSize: -5 }`) and a negative `letter-spacing` is fine, but
  negative font sizes are not.
- evidence: read
- severity: low

## A conic gradient's center ignores `gradientUnits="userSpaceOnUse"` length semantics
- where: packages/svg/src/readGradients.ts:214 (readConicGradient)
- scenario: `<wzl:conicGradient gradientUnits="userSpaceOnUse" cx="50%" cy="50%">` → `num` reads "50%" through
  `parseRatio` as 0.5 world units, where linear and radial gradients in the same units resolve a percentage against
  the viewport through `coord`/`resolveLength`. The center lands at (0.5, 0.5) instead of the viewport's middle.
  Absent `cx`/`cy` in world units likewise default to 0.5 user units rather than 50% of the viewport.
- evidence: read
- severity: low

## A `<tspan font-style="normal">` inside italic text stays italic, silently
- where: packages/svg/src/readRuns.ts:102 (readTspanRun)
- scenario: `<text font-style="italic">a<tspan font-style="normal">b</tspan></text>` → only `'italic'` sets anything
  on the run; `'normal'` is dropped, and `resolveRuns` (packages/text/src/runs/resolveRuns.ts:171) falls back to the
  node's `fontStyle: 'italic'`, so "b" renders italic where a browser draws it upright. No warning is raised. The
  weight beside it handles the same case (`'normal'` → `fontWeight: 400`), so the two own-property overrides answer
  "the run resets the inherited value" two different ways.
- evidence: read
- severity: medium

## A tspan's user-space stroke gradient is not carried through the text's transform
- where: packages/svg/src/readText.ts:75 (placeTextNode)
- scenario: `<text transform="translate(100 0) scale(2)"><tspan stroke="url(#g)">x</tspan></text>` with `#g` in
  `userSpaceOnUse` → the node's own fill and stroke paints and every run's fill go through `fillThroughMatrix(…, inBox)`,
  but the `runs.map` only rewrites `r.fill`; a run's `stroke.paint` keeps the element-space coordinates, so the run's
  stroke gradient lands offset and unscaled relative to the glyphs it strokes, while the same gradient on the `<text>`
  itself lands correctly.
- evidence: read
- severity: medium

## A run's fill takes on the node's `fill-opacity` when written, and an opacity-1 run stroke takes the node's `stroke-opacity`
- where: packages/svg/src/serializeText.ts:189 (runAttrs), :212 (strokeResets)
- scenario: a text node with fill `{ solid #00f, opacity 0.5 }` and a run with fill `{ solid #f00 }` (opaque — a run's
  fill replaces the node's). `runAttrs` writes `<tspan fill="#f00">` with no `fill-opacity`, so the tspan inherits the
  `<text>`'s `fill-opacity="0.5"`: a browser draws the run half transparent, and `readTspanRun` → `coreTextFill`
  reads it back as red at 0.5. Strokes get a reset for exactly this (`strokeResets` writes `stroke-opacity="1"`),
  fills get none. The stroke reset itself misses a run whose paint says `opacity: 1`: `opacityAttr` drops 1 and
  `strokeResets` sees a non-null opacity, so nothing is written and the node's `stroke-opacity` is inherited.
- evidence: read
- severity: medium

## A `<tspan>` nested inside a `<tspan>` loses its styling silently
- where: packages/svg/src/readRuns.ts:95 (readTspanRun), :54 (readRuns)
- scenario: `<text><tspan font-weight="bold">a<tspan fill="red">b</tspan></tspan></text>` (Inkscape and Illustrator
  write nested tspans routinely) → `readRuns` walks only the `<text>`'s direct children, and `readTspanRun` takes the
  outer tspan's whole `textContent` ("ab") as one run with the outer tspan's attributes. The inner tspan's `fill`,
  weight, size, `x`/`dy` and so on are dropped, with no warning, while a non-tspan child of `<text>` does warn
  (line 60). "b" renders black instead of red.
- evidence: read
- severity: medium

## Two attributes of a namespaced element with the same local name overwrite each other
- where: packages/svg/src/readMeta.ts:61 (collectNamespacedElement)
- scenario: `<foo:item id="a" foo:id="b" xlink:href="#x"/>` under a declared `foo` → every attribute is stored by
  `a.localName` alone, so `id` and `foo:id` collide and the last one wins, and `xlink:href` comes back as a bare
  `href`. The namespace bag is documented to round-trip declared-namespace content losslessly (types.ts:17), but the
  value of one attribute is lost on read.
- evidence: read
- severity: low

## Every imported document's markers stay registered globally, with no way to release them
- where: packages/svg/src/unpack.ts:187 (svgNodesToKitDrafts)
- scenario: a long editing session that drops many different SVGs, each with its own `<marker>` defs → each def is
  minted under a fresh `${id}-${hash}` key (readMarkers.ts:299) and `registerMarker(m)` is called with the disposer
  thrown away. Nothing unregisters them when the nodes using them are deleted or the scene is torn down, so the
  global marker registry grows by every distinct marker ever imported.
- evidence: read
- severity: low

## Files read
packages/svg/src/patterns.ts
packages/svg/src/pbt.fixture.ts
packages/svg/src/placeBox.ts
packages/svg/src/prettyXml.ts
packages/svg/src/properties.ts
packages/svg/src/readClips.ts
packages/svg/src/readGradients.ts
packages/svg/src/readImage.ts
packages/svg/src/readMarkers.ts
packages/svg/src/readMeta.ts
packages/svg/src/readPaint.ts
packages/svg/src/readRuns.ts
packages/svg/src/readText.ts
packages/svg/src/regionSvg.ts
packages/svg/src/regionSvgNodes.ts
packages/svg/src/resolvedDashes.ts
packages/svg/src/seatedHeads.ts
packages/svg/src/serialize.ts
packages/svg/src/serializeBounds.ts
packages/svg/src/serializeOptions.ts
packages/svg/src/serializeText.ts
packages/svg/src/shapes.ts
packages/svg/src/specificity.ts
packages/svg/src/strokeAttrs.ts
packages/svg/src/strokeOutlineSvg.ts
packages/svg/src/styleAt.ts
packages/svg/src/stylesheet.ts
packages/svg/src/supports.ts
packages/svg/src/testing/roundTrip.ts
packages/svg/src/textAnchor.ts
packages/svg/src/textLang.ts
packages/svg/src/textModes.ts
packages/svg/src/textOutlines.ts
packages/svg/src/textWhitespace.ts
packages/svg/src/transform.ts
packages/svg/src/trimmedStroke.ts
packages/svg/src/tspanLines.ts
packages/svg/src/types.ts
packages/svg/src/unpack.ts
packages/svg/src/unpackFiles.ts
packages/svg/src/use.ts
packages/svg/src/userScale.ts
packages/svg/src/viewBox.ts
packages/svg/src/warm.ts

<!-- done: 10 findings, files read: 44 -->
