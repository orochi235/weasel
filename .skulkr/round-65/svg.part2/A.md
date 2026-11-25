I couldn't write `.skulkr/out/findings.md`: every write was refused for lack of permission. As the brief says to do in that case, the whole document is below.

```markdown
# Audit round 65 — svg.part2 findings

## A paint reference that resolves to nothing paints solid black instead of none
- where: packages/svg/src/readPaint.ts:31-46 (readPaint)
- scenario: `<rect fill="url(#missing)"/>`, or `<path stroke="url(#p)"/>` where `#p` is a hand-authored `<pattern>` (no `data-weasel-tile`). `collectPatterns` drops that pattern (patterns.ts:100-104) before it reaches the table `parse.ts:94` merges. With no fallback colour, readPaint warns and returns `{ kind: 'solid', color: defaultColor }`, which is `#000000` for both fill and stroke (readStroke passes `'#000000'`). SVG 2 paints an invalid paint-server reference with no fallback as `none`, and browsers draw nothing. So every Inkscape or Illustrator pattern fill, or dangling gradient ref, imports as a solid black shape, and a stroke as a black outline.
- evidence: read
- severity: medium

## readStroke drops marker-start/mid/end on any element whose stroke is `none` or unset, though SVG draws them
- where: packages/svg/src/readPaint.ts:67-71 (readStroke)
- scenario: `<path d="M0 0L50 0" marker-end="url(#arrow)"/>` (no `stroke`), or `<path stroke="none" marker-end="url(#arrow)"/>`. SVG renders markers whatever the stroke paint is. readStroke returns `undefined` when `inheritedStroke == null && inheritedWidth == null`, and again when `paint.kind === 'none'`, so the marker refs never reach `ingestMarkers` and the head is lost. Export answers this the other way: `serializeBounds.ts` `inked` says "SVG draws markers under `stroke="none"` too" and boxes them, and `strokeAttrsFor` writes `stroke="none"` beside `marker-*`. So an `SvgStroke` with paint none and markers does not round-trip.
- evidence: read
- severity: medium

## A tspan's absolute or em `baseline-shift` is divided by the tspan's own font size, but `baselineShift` is in ems of the inherited size
- where: packages/svg/src/properties.ts:250-262 (readBaselineShift), called from packages/svg/src/readRuns.ts:117 with `fontSizeOf(tspanStyle)`
- scenario: `<text font-size="20"><tspan font-size="10" baseline-shift="5px">x</tspan></text>`. SVG raises the glyph 5px. readBaselineShift computes `5 / 10 = 0.5`, and `StyledRun.baselineShift` is documented (text/src/runs.ts:59-63) in ems of the *inherited* size (20), so the run rises 10px. `baseline-shift="0.5em"` goes through `emLength`, which returns 0.5 own-ems and stores them as parent-ems: same error. Only the percentage branch uses the unit the field holds. The error is ownSize/parentSize whenever a tspan sets both `font-size` and a length shift.
- evidence: read
- severity: low

## A declaration CSS rejects overrides a valid one for stroke-width, font-size, dasharray, dashoffset, letter-spacing, markers and clip-path
- where: packages/svg/src/properties.ts:293-305,313,321-323 (`invalid` predicates), used by packages/svg/src/cascade.ts:152-155 (`take`)
- scenario: `<path stroke="#000" stroke-width="5" style="stroke-width: thick"/>`. CSS drops `thick` at parse time, so a browser strokes at 5.
  - **stroke-width:** `invalid` is only `isNegative`, so `cascaded` keeps `thick`. `worldLength` then reads it as `undefined`, and readStroke falls back to `?? 1`: the line imports 1 wide.
  - **font-size:** `font-size: big` behaves the same way (its `invalid` is only `isNegative`).
  - **stroke-dasharray, stroke-dashoffset, letter-spacing:** these have no `invalid` at all. So `stroke-dasharray: -1 2` loses the attribute's dash.
  - **marker-*, clip-path:** no `invalid` either. `marker-end: arrow` over `marker-end="url(#a)"` drops the head.
  - **fix scope:** a value with no `(` that `dimension()` (or `parseUrlRef`) cannot read is outside each of these grammars, so it can be rejected without touching the function cases the comment means to keep.
- evidence: read
- severity: low

## `<marker refX="center">` (or right/bottom) without a viewBox resolves to 0
- where: packages/svg/src/readMarkers.ts:245,254 (markerEntryFrom → markerRef)
- scenario: `<marker markerWidth="10" markerHeight="6" refX="center" refY="center">` with no `viewBox`. markerRef gets `lo = 0, span = 0`, so every keyword gives 0. SVG resolves the keywords against the marker's viewport, so `center` is markerWidth/2 = 5 (refY 3). The head is anchored at its corner instead of its centre.
- evidence: read
- severity: low

## Marker children that are `display="none"` are drawn into the head
- where: packages/svg/src/readMarkers.ts:260-274 (markerEntryFrom `collect`)
- scenario: `<marker id="m"><path d="…"/><path display="none" d="…"/></marker>`. `collect` lowers every SUPPORTED_LEAF_TAGS child and recurses into every `<g>` without checking `display`, and `lowerLeaf` has no display or visibility check either. So the hidden part is merged into the entry's one path, and its differing style triggers the "paints its parts differently" warning. SVG does not render it.
- evidence: read
- severity: low

## A mesh patch point written `x,` parses as `(x, 0)` instead of being rejected
- where: packages/svg/src/readGradients.ts:239-244 (readMeshGradient)
- scenario: `points="… 10, …"`. `'10,'.split(',').map(Number)` is `[10, 0]`, because `Number('') === 0`. The pair passes the `Number.isFinite` sanity check, so a truncated or hand-edited patch is accepted with an invented y = 0. The docblock says an unparseable patch is dropped rather than guessed at.
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

<!-- done: 7 findings, files read: 44 -->
```

<!-- done: 7 findings, files read: 44 -->