# Findings — svg.part2 (round 55)

## A `<text>`-level `baseline-shift` is dropped from every `<tspan>` run, so a node-level `script` with runs loses its shift on round trip
- where: packages/svg/src/readRuns.ts:54-57 (readRuns / readTspanRun), with packages/svg/src/readText.ts:124 and packages/svg/src/serializeText.ts:85
- scenario: a text node `{ style: { script: 'sub' }, runs: [{ text: 'a', bold: true }, { text: 'b' }] }` is serialized as `<text baseline-shift="sub">` holding one `<tspan>` per run. On read, `inheritedShift` (the `<text>`'s own `baseline-shift`) is spread only into bare text-node pieces (`{ text: t, ...inheritedShift }`); a `<tspan>` piece gets `readTspanRun(...)`, which reads only the tspan's own `baseline-shift`. `readTextStyle` does not read `baseline-shift` either, so the node comes back with neither `style.script` nor any run `script`: the subscript draws as ordinary text. The same happens for any external document with `<text baseline-shift="super"><tspan>…</tspan></text>`, which a browser draws shifted. The only test (roundtrip.textScript.test.ts:19) uses a node with no runs, where the bare-text path carries it.
- evidence: read
- severity: medium

## `strokeDataFromSvg` drops the stroke's `align`, so an inner/outer-aligned stroke unpacks centered
- where: packages/svg/src/unpack.ts:109-131 (strokeDataFromSvg)
- scenario: a kit path with `stroke: { width: 4, align: 'inner', … }` is exported; `writesOutline` writes it as an outline with `wzl:stroke-align="inner"`, and `parseSvg` restores `align: 'inner'` on the `SvgStroke` (`withOutlinedStroke`, parse.ts:299). `svgNodesToKitDrafts` then builds the leaf's `data.stroke` through `strokeDataFromSvg`, which copies cap, join, dash, dashOffset, miterLimit, markers, vertexWidths, nib and trim but not `align`, so the unpacked node strokes centered on its edge — half the stroke spills outside a shape that drew it inside. `coreStroke` (readPaint.ts:147) and `kitStroke` (strokeOutlineSvg.ts:100) both carry `align`; this third copy of the field list is the one that misses it. Same loss for a group's stroke through `containerPaint` and a box's `border` through `boxPaint`.
- evidence: read
- severity: medium

## The fit-clamp in `unpackSvgFiles` turns an inherited stroke (`'inherit'`) into a garbage object and never scales the container's own stroke
- where: packages/svg/src/unpackFiles.ts:33-45 (scaleLeafData) and :105-107
- scenario: drop `<svg><g stroke="black" stroke-width="10"><path d="M0 0H5000"/></g></svg>` on a canvas whose viewport is narrower than 5000/0.9 units, so `scale < 1`. `groupPaint`/`inheritsFrom` mark the path as taking the group's stroke, so `svgNodesToKitDrafts` drafts the group with `data.stroke = { width: 10, … }` and the leaf with `data.stroke = INHERIT`, which is the string `'inherit'`. `scaleLeafData` sees a truthy `out.stroke` and calls `scaleStroke('inherit', scale)`: destructuring a string yields no width, and `{ ...stroke, ...scaledVertices }` spreads the string into `{0:'i',1:'n',…,6:'t'}`, which replaces the inherit marker — the leaf now has a paintless stroke of its own and draws no stroke at all. Separately, only `kind === 'mark'` drafts are scaled, so the group's `data.stroke` (what an intact `'inherit'` would read) and a painted group box's `border` keep the source width: even without the first bug, inherited strokes would arrive at full size on geometry shrunk by `scale`. Should be: skip `INHERIT` (as with fill) and scale the stroke/border lengths in group drafts' data as well.
- evidence: read
- severity: high

## Keyword properties are validated case-insensitively but read case-sensitively, so `display="None"` or `stroke-linejoin: Round` override the declaration below them and then read as absent
- where: packages/svg/src/properties.ts:245-247 (invalidOf), with :70-71 (keyword) and :291 (display)
- scenario: CSS keywords are ASCII case-insensitive, and `invalidOf(…, 'unread')` agrees: it runs the reader on `v.toLowerCase()`, so `stroke-linejoin: Round` is valid and the cascade (cascade.ts:152) keeps it over a lower-ranked `stroke-linejoin="round"`. But `readProperty` hands the reader the value as written, and `keyword(...)` compares exactly, so `readLinejoin('Round')` warns "unsupported stroke-linejoin" and returns `undefined`: the path draws mitered where a browser draws round joins. The same holds for `fill-rule`/`clip-rule: EvenOdd` (filled nonzero), `text-anchor: Middle`, `direction: RTL`, `visibility: Hidden`, `vector-effect`, and `display="None"`, whose reader has no `invalid` at all, so the element is drawn where a browser hides it. `isDeclarationHonored` then answers `@supports (fill-rule: EvenOdd)` false for a value every browser honors. Two places decide the same value two ways; the reader should fold case where the validator does.
- evidence: read
- severity: medium

## A `<pattern>` holding one `<image>` is read as an `image` paint without checking the image's `preserveAspectRatio` or `transform`
- where: packages/svg/src/patterns.ts:122-137 (readImagePattern)
- scenario: a hand-authored `<pattern id="p" patternUnits="userSpaceOnUse" width="20" height="10"><image href="a.png" width="20" height="10"/></pattern>` (no `preserveAspectRatio`, so SVG's default `xMidYMid meet`) with a square bitmap draws the picture letterboxed 10×10 in the middle of each tile; one with `<image … transform="rotate(45 10 5)">` draws it turned. `readImagePattern` checks only the image's `x`/`y`/`width`/`height`, so both come back as `{ kind: 'image', width: 20, height: 10 }`, which fills the tile stretched and upright — and silently, where `parseImageElement` (readImage.ts:23-26) warns for the same non-`none` `preserveAspectRatio` on a bare `<image>`. The writer always emits `preserveAspectRatio="none"` and no transform (patterns.ts:54), so requiring those (or falling through to the unsupported-pattern warning) keeps its own output reading back.
- evidence: read
- severity: low

## `roundTrip` test helper claims a deep-equal round trip but normalizes away most fields, so their loss passes
- where: packages/svg/src/testing/roundTrip.ts:87-154 (normalize)
- scenario: the header says the golden tests assert `parseSvg(serializeSvg(parseSvg(svg).nodes)).nodes` deep-equals `parseSvg(svg).nodes`, but `normalize` keeps only a handful of fields per kind: a path's `rotation`, `hidden`, `inherits`, `meta`; a group's `fill`, `stroke`, `hidden`, `boolean`; a text node's `fill`, `stroke`, `rotation`, `transform`, `verticalAlign`, `hidden`; an image's `source`, `flipX`/`flipY`, `transform`, `hidden` are all dropped before comparing. A serializer change that loses, say, a text node's fill or an image's flip passes every golden fixture that runs through this helper. The comparison should cover every field the node carries (rounding the numeric ones), or the doc should say what it does not check.
- evidence: read
- severity: low

## The fit-clamp leaves a framed text leaf's `padding` at source size
- where: packages/svg/src/unpackFiles.ts:33-45 (scaleLeafData), with packages/svg/src/framedText.ts:57-63
- scenario: a text node with a background (`textFrame` group) unpacks as one text mark whose data carries `padding` in world units (`text.pose.x - box.x`). Dropping that file at a size the viewport clamps (`scale = 0.25`) scales the mark's pose, font size and letter spacing, but `scaleLeafData` knows only `stroke`, `style` and `runs`, so `padding` stays 4× too large relative to the shrunk box: the text is pushed in from the frame's edge by its source inset, clipping or wrapping it where `overflow: 'clip'` is set.
- evidence: read
- severity: low

## A `<marker>`'s outline width is read with `parseFloat`, ignoring the units every other stroke width converts
- where: packages/svg/src/readMarkers.ts:279 (markerEntryFrom)
- scenario: `<marker …><path d="…" stroke="black" stroke-width="0.5mm"/></marker>`: a stroke elsewhere reads `stroke-width` through `readProperty`'s `worldLength`, which converts `mm` to 1.89 user units, but the marker's outline takes `parseFloat(first['stroke-width'])` = 0.5, so the head's outline draws at about a quarter of its width. A percentage (`10%`) reads as 10 marker units instead of being warned about. Reading it with `styleValue(first, 'stroke-width', onWarn)` gives the one answer.
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

<!-- done: 8 findings, files read: 44 -->
