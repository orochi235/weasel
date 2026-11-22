# Audit round 66 — svg.part2 findings

## A fill or stroke value the cascade keeps but `readPaint` cannot read paints solid black, so an unreadable stroke draws a black outline
- where: packages/svg/src/readPaint.ts:24-27 (readPaint), reached from readStroke at :84
- scenario: `<rect style="stroke: var(--accent)" …/>` (or `stroke="color-mix(in srgb, red, blue)"`, `stroke="rgb(1,2"`). The cascade keeps any value containing `(` (`unreadColor` in properties.ts:300 treats a function as possibly valid, so `cascade.ts:153` does not drop it); `readProperty('stroke', …)` then returns undefined and `readPaint` returns `{ kind: 'solid', color: defaultColor }` — `#000000` for the stroke as well as the fill — so `readStroke` emits a 1-unit black stroke on a shape a browser draws unstroked (an unresolvable `var()` makes the property `unset`: stroke falls back to its inherited value / `none`). The fill likewise ignores the inherited fill and goes black. The `opacity` read just above is also dropped on this path.
- evidence: read
- severity: medium

## Unpacking drops a marker-carrying stroke whose paint is `none`, so imported arrowheads vanish
- where: packages/svg/src/unpack.ts:113 (strokeDataFromSvg), used by leafDraft at :338 and containerPaint at :362
- scenario: `unpackSvgFiles` on `<path d="M0 0L50 0" stroke="none" marker-end="url(#arrow)"/>`. `readStroke` deliberately keeps this stroke (readPaint.ts:79-85: "SVG draws markers whatever the stroke paints"), `parseSvg`→`serializeSvg` round-trips it (markers.test.ts:40-44), and the kit's `Stroke.paint` is optional precisely so a paintless stroke keeps its other fields (paint.ts:169-171). But `strokeDataFromSvg` returns `undefined` whenever `stroke.paint.kind === 'none'`, so the leaf's data gets no `stroke` and its `markerStart`/`markerEnd` are lost; the arrowhead the browser draws is not in the scene. It should return the stroke without `paint` when it carries a marker. (Whether the kit painter then draws heads for a paintless stroke is inference; the data loss itself is read.)
- evidence: read
- severity: medium

## A text run whose own stroke has a non-finite dash loses that stroke and so inherits the node's
- where: packages/svg/src/resolvedDashes.ts:42-48 (textStroke), applied to runs at :52
- scenario: a text node with `stroke: {paint: red, width: 2}` and one run with `stroke: {paint: blue, width: 1, dash: [NaN]}` (or `Infinity`). `dashPattern` says `'non-finite'`, which draws no stroke; `resolvedDash(…, false)` returns `null`, and `textStroke` returns the run *without* a `stroke` key. In the runs model (and in `runAttrs`, serializeText.ts:201-204) an absent run stroke means "take the node's", so the `<tspan>` is written with no stroke attributes and draws the node's red stroke, where the canvas draws that run unstroked. The run should keep an empty override (`stroke: {}`, which `runAttrs` writes as `stroke="none"`). The same function on a text node that `inherits.stroke` from its group drops the node's stroke but leaves `inherits.stroke`, so the `<text>` takes the group's attribute stroke.
- evidence: read
- severity: low

## Under `keepHidden`, a `<use>` whose target is `display="none"` is dropped instead of arriving hidden
- where: packages/svg/src/use.ts:51 (parseUse)
- scenario: `parseSvg('<svg><g id="a" display="none"><rect …/></g><use href="#a" x="10"/></svg>', { keepHidden: true })` (what `unpackSvgFiles` passes). The `<g id="a">` itself is kept as a hidden node by `readChild` (parse.ts:201-206), but `parseUse` returns `null` for the same target before `draw`, so the instance is silently lost — no node, no warning. Hidden content is meant to "arrive hidden rather than being left out" (unpackFiles.ts:57-58, `ParseOptions.keepHidden`); `readChild` already marks a hidden target hidden, so the early return answers "is this hidden content kept" differently from every other element.
- evidence: read
- severity: low

## A `stroke-dasharray` length in a unit the reader does not convert is dropped as invalid, where `stroke-width` reads the same unit as its number
- where: packages/svg/src/properties.ts:134 (readDashArray), :312 ('stroke-dasharray' registered with 'plain')
- scenario: `stroke-dasharray: 5% 2%` (valid CSS; percentages and `vw`/`vh` are legal lengths here) — `pxPer('%')` is undefined, so `readDashArray` warns and returns `undefined`; with the `'plain'` invalid rule, `isDeclarationInvalid` then reports it invalid and `cascade.ts:153` drops the declaration as if never written, so a lower-ranked `stroke-dasharray` (or the inherited one) stands silently. `stroke-width: 5%` / `stroke-dashoffset: 5%` go through `length()`, which warns and keeps the number. One question ("what does an unconverted unit in a stroke length mean") answered two ways, and the dasharray answer also lets CSS-valid input change which declaration wins.
- evidence: read
- severity: low

## Pattern `x` / `y` are parsed with `parseFloat`, so a unit or percentage is read as its bare number and an empty value is NaN
- where: packages/svg/src/patterns.ts:154-155 (readPlacement)
- scenario: `<pattern patternUnits="userSpaceOnUse" x="10%" …>` or `x="1em"` → origin 10 / 1 user units rather than the resolved length, with no warning; `x=""` → `parseFloat('')` is NaN, `NaN !== 0` so `placement.origin = {x: NaN, …}` lands on the paint. Every other length on the read path goes through `readLength` / `resolveLength`, which convert units and warn.
- evidence: read
- severity: low

## Specificity counts a namespace prefix as a second type selector
- where: packages/svg/src/specificity.ts:82-87 (specificity)
- scenario: `@namespace svg url(http://www.w3.org/2000/svg); svg|rect { fill: red } rect.a { … }` — `svg|rect` scores (0,0,2): `svg` and `rect` each hit the identifier branch and `|` is skipped, where Selectors 4 gives a namespace prefix no specificity, (0,0,1). Against `g rect` (0,0,2) it now ties and source order decides instead of the later/higher rule; against an equal-weight rule written earlier it wins wrongly. `*|rect` is unaffected (the `*` is skipped), so the same selector scores differently by how its namespace is spelled.
- evidence: read
- severity: low

## `<title>`, `<desc>` and `<metadata>` inside `<defs>` warn as "unsupported <defs> child"
- where: packages/svg/src/readGradients.ts:60-69 (DEFS_READ / warnUnsupportedDefsChildren)
- scenario: `<defs><title>Icons</title><linearGradient id="g">…</defs>` → warning `unsupported <defs> child: <title>`, although the walk deliberately ignores these tags (`IGNORED_TAGS` in lowerLeaf.ts lists `title`, `desc`, `metadata`) and nothing is lost. `DEFS_READ` and `IGNORED_TAGS` answer "is this child something we handle" differently.
- evidence: read
- severity: low

## Files read
packages/svg/src/parse.ts
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

<!-- done: 8 findings, files read: 45 -->
