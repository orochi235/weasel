# Audit round 55 — svg.part2 findings

## A `<tspan>` that sets only `stroke-width` (or cap, join, dash) under a stroked `<text>` loses the override
- where: packages/svg/src/readPaint.ts:125 (ownStrokeStyle) with readPaint.ts:61-71 (readStroke), called from readRuns.ts:128 (readTspanRun)
- scenario: `<text stroke="red" stroke-width="1"><tspan stroke-width="5">x</tspan></text>`. `ownStrokeStyle` returns `{ 'stroke-width': '5' }` only; `readStroke` then calls `readPaint(style, 'stroke', …)` on a style with no `stroke`, gets `{ kind: 'none' }`, and returns `undefined`. The run gets no `stroke`, so it draws with the node's width 1 instead of 5. The same happens for a tspan setting only `stroke-dasharray`, `stroke-linecap`, `stroke-linejoin`, `stroke-opacity` or a marker. The run's stroke fields should be read against the inherited paint (or the run should carry just the overridden fields).
- evidence: read
- severity: medium

## A `<tspan stroke="inherit">` gets a black stroke and a spurious warning
- where: packages/svg/src/readPaint.ts:128 (ownStrokeStyle) → readPaint.ts:24 (readPaint)
- scenario: `<text stroke="red"><tspan stroke="inherit">x</tspan></text>`. `setsOwn` is false for `inherit`, so `ownStrokeStyle` writes the literal `'inherit'` into `out.stroke`. `readStroke` sees a non-null stroke and calls `readPaint`, where `readProperty('stroke', 'inherit')` returns `undefined` (CSS-wide keyword), so it warns "unrecognized stroke value: inherit" and returns solid `#000000`. The run is stroked black instead of inheriting red (it should carry no stroke of its own). `stroke="unset"` behaves the same.
- evidence: read
- severity: medium

## `text: 'embed'` declares the substituted face's family but the `<text>` keeps naming the requested one
- where: packages/svg/src/textModes.ts:40-44 (embeddingOf), textModes.ts:79-81 (withTextMode → embedded), textModes.ts:120 (fontFacesXml)
- scenario: a text node with `fontFamily: 'Brand'` where no `Brand` face is registered, so the font registry substitutes a fallback family (`cachedFontVariant(...).resolved`; `resolveFontVariant.ts` builds it through `missResolveResult`'s fallback family) and the canvas draws it in, say, `Inter`. `embeddingOf` returns the resolved face, so the document gets `@font-face{font-family:"Inter";…}`, but `embedded()` returns the node unchanged because it already has a `fontFamily`, so the element says `font-family="Brand"`. A reader matches no `@font-face` to `Brand` and sets the text in its own default face, not the face embedded, with no warning. The written family should be the one embedded, or the face should be declared under the family name the text uses.
- evidence: read (that a resolved family can differ from the requested one is inferred from `resolveFontVariant.ts`'s fallback path, not run)
- severity: medium

## `svgNodesToKitDrafts` drops a stroke's `align`, so an inner or outer stroke re-imports centered
- where: packages/svg/src/unpack.ts:109-131 (strokeDataFromSvg)
- scenario: export a path whose stroke is `align: 'inner'`; `serializeSvg` writes it as an outline with `wzl:stroke-align="inner"`, and parsing restores `SvgStroke.align` (`withOutlinedStroke`, strokeOutlineSvg.ts:148-149). `strokeDataFromSvg` then copies every stroke field — cap, join, dash, markers, `vertexWidths`, `nib`, `trim` — except `align`, so the drafted `kit:path` stroke is centered: half its width lands outside the shape and the shape grows by it. The other lowering of the same type, `coreStroke` (readPaint.ts:147) and `kitStroke` (strokeOutlineSvg.ts:100), both carry `align`; this third copy of the mapping drifted.
- evidence: read
- severity: medium

## Dropping a large SVG scales leaves' stroke widths but not a group's, which its children draw with
- where: packages/svg/src/unpackFiles.ts:105-107 (unpackSvgFiles, `scaleLeafData` applied only to `kind: 'mark'`)
- scenario: drop a file twice the viewport's size, `<g stroke="black" stroke-width="4"><path d="…"/><path d="…" stroke-width="4"/></g>`, so the fit-clamp scale is about 0.45. The second path's own stroke is scaled to about 1.8. The first path sets no stroke, so `takesOf` drafts it with `stroke: INHERIT`, reading the group's `data.stroke` from `containerPaint` — and group drafts skip `scaleLeafData`, so it keeps width 4. Two strokes that were equal in the file arrive at 4 and 1.8. The same holds for a group's `border` (`boxPaint`) and a container's dash.
- evidence: read
- severity: medium

## The golden round-trip helper compares polygon coords without their `origin`
- where: packages/svg/src/testing/roundTrip.ts:69-85 (normalizeOutline), roundTrip.ts:139-143 (normalize)
- scenario: `PolygonPath.coords` are measured from `path.origin` when one is set (geom `path.ts:48`; `worldCoords` adds it back), and the shape lowerers here build with `PathBuilder().autoOrigin()`. `normalize` copies `path.coords` raw and never reads `origin`, for leaves and for clips. A round trip that moves a shape by changing only its origin compares equal and passes; one that keeps the world geometry but re-origins it (for example, coords baked through a transform onto a different origin) fails. It should compare `worldCoords(path)`.
- evidence: read
- severity: low

## `dominant-baseline` is read only as the `<text>`'s own attribute, not through the cascade
- where: packages/svg/src/readText.ts:115-119 (parseTextElement)
- scenario: `<g dominant-baseline="hanging"><text y="10">A</text></g>`, or `<style>text{dominant-baseline:text-before-edge}</style>`. Browsers place the top of the text at `y=10` (the property inherits and can be set in CSS). `el.getAttribute('dominant-baseline')` sees nothing, so `topY = firstY - fontSize` and the box lands one font size too high. The property is not in `PROPERTIES`, so neither `style=`, a stylesheet, nor an ancestor reaches it, unlike every other text property read here.
- evidence: read
- severity: low

## A marker's outline width ignores the unit on `stroke-width`
- where: packages/svg/src/readMarkers.ts:279 (markerEntryFrom)
- scenario: `<marker …><path d="…" stroke="black" stroke-width="0.5mm"/></marker>`. The width is `parseFloat(first['stroke-width'])`, which reads `0.5`, where the cascade's own reader (`readProperty('stroke-width', …)`, `worldLength`) converts `0.5mm` to about 1.89 user units, as it does for every other stroke. The marker's outline is drawn at about a quarter of its width. A value of `inherit`/`unset` reaching here becomes `NaN`, which drops the outline instead of using the inherited width.
- evidence: read
- severity: low

## `baseline-shift` in an absolute or font-relative unit other than em is read as that many ems
- where: packages/svg/src/properties.ts:221-232 (readBaselineShift)
- scenario: `<tspan baseline-shift="4px">`. `emLength` has no px→em conversion, so it warns and returns 4, a shift of four ems (64 px at 16 px text) instead of 4 px. `readBaselineShift` receives no font size (the `read` signature passes one, but it is not taken) and calls `emLength` with `DEFAULT_FONT_SIZE`, so a px, pt or mm shift cannot be converted to the ems `baselineShift` is stored in, though the element's font size is known at the call site.
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

