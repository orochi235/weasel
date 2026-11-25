I couldn't write `.skulkr/out/findings.md`: both attempts were blocked waiting for write permission. As the brief allows, the whole findings document is below. One more thing: the checkout's HEAD is `6f634fabe1`, not the frozen commit `1b4edb3a…` named in the brief. I cited paths and lines as they stand at HEAD.

# Audit round 63 — svg.part2 findings

## The viewBox parser rejects abutting numbers that the transform parser accepts
- where: packages/svg/src/viewBox.ts:12 (parseViewBoxAttr)
- scenario: a minified `viewBox="0-10 100 100"` is four numbers under SVG's number grammar, and browsers read it that way. This parser splits only on whitespace and commas, so it gets three parts and returns `undefined`. The viewBox is then dropped for the root, a marker, a cropped image or a nested svg (parse.ts, readMarkers.ts, readImage.ts, lengths.ts). transform.ts's `ARG` reader deliberately accepts the same abutting form (`1-2`, `.5.5`), so two number-list readers in the package answer the same grammar question differently. Also, `parseFloat` accepts trailing junk: `"10px 0 5 5"` reads as 10, where a browser rejects the whole viewBox.
- evidence: read
- severity: medium

## Negative stroke-width and font-size are kept instead of dropped
- where: packages/svg/src/properties.ts:271 (`'stroke-width': inherited(worldLength)`), :155 (readFontSize), :282
- scenario: for `stroke-width="-2"` or `font-size="-12px"`, `dimension` accepts the sign and the reader returns -2 or -12. Neither property has an `invalid` predicate, so `isDeclarationInvalid` answers false and cascade.ts:153 keeps the declaration. CSS rejects negative values for both properties, so the declaration below it or the inherited value should stand. Instead a negative width, or a negative font size, reaches the node. `-50%` gives a negative `fontScale`. fontSize.ts `computeFontRelative` does not clamp it either.
- evidence: read
- severity: medium

## A tspan's `font-style="normal"` silently fails to undo an italic `<text>`
- where: packages/svg/src/readRuns.ts:102 (readTspanRun)
- scenario: `<text font-style="italic">a<tspan font-style="normal">b</tspan></text>`. The run sets `italic = true` only for `'italic'` and records nothing for `'normal'`. The runs model resolves `run.italic ? 'italic' : style.fontStyle` (text/src/runs/resolveRuns.ts:171), so `b` takes the node's italic, while a browser draws it upright. No warning is raised. font-weight has the matching branch (`normal` → `fontWeight = 400`, line 100); font-style has none. The serializer has the same gap: serializeText.ts:157 `runAttrs` writes only `italic`.
- evidence: read
- severity: low

## An unclosed style block loses the last character of its body
- where: packages/svg/src/stylesheet.ts:142,160 (parseRuleList)
- scenario: in `<style>rect{fill:red</style>`, `skipBlock` returns `src.length` because no `}` closes the block (cssScan.ts:89). The body is then sliced as `(i + 1, end - 1)`, which assumes `end - 1` is the `}`. The declaration reads `fill:re`, an invalid color, so the rect gets the initial black. CSS closes an open block at the end of the sheet, so a browser draws it red. An unclosed `@media` or `@layer` body loses the last character of its last rule the same way (lines 150, 154, 157).
- evidence: read
- severity: low

## font-weight `lighter` is not read
- where: packages/svg/src/properties.ts:168-173 (readFontWeight)
- scenario: take `<g font-weight="bold"><text font-weight="lighter">`. `keyword('normal','bold','bolder')` returns undefined and nothing is warned, so the declaration counts as unreadable and the parent's bold is inherited. The text imports bold where a browser draws it at normal weight. `bolder` is read but its counterpart is dropped silently, and `@supports (font-weight: lighter)` answers false.
- evidence: read
- severity: low

## `dominant-baseline="text-top"` is read as a baseline anchor
- where: packages/svg/src/readText.ts:118-119 (parseTextElement)
- scenario: only `text-before-edge` and `hanging` make `y` the box top. `text-top` is SVG 2's spelling for the top of the em box, and properties.ts:288 accepts it as a value. A `<text y="10" dominant-baseline="text-top">` is therefore placed as if `y` were the alphabetic baseline: the box top lands at `y - fontSize`, one font size above where a browser draws the glyphs.
- evidence: read
- severity: low

## Pattern export ignores the paint's `units`
- where: packages/svg/src/patterns.ts:59-77 (patternBoxAttrs)
- scenario: every pattern is written `patternUnits="userSpaceOnUse"`, with `origin` taken as user-space x/y, whatever `paint.units` says. A tile paint with `units: 'bounds'` handed straight to `serializeSvg` should be anchored to the painted node's box (paint/src/patternPaint.ts:14-19). It is written anchored at the user-space origin, with no warning, while a `bounds` gradient in the same call is written as `objectBoundingBox`. The kit export path converts paints with `paintToLocalUnits` first (fromKit.ts, kitPaint.ts), so only direct `serializeSvg` callers are affected.
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