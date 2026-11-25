# Audit round 66, area svg.part2 — findings

Note: the brief names commit 64f0b083bc66bebeb52e9c5a64e5b2587c66b45b, but this checkout's HEAD is
1eae5ad17c4a29325f133d1fdcce46eab891be05 and `git` reports 64f0b08 as a bad object here. So I couldn't check
these files against it. Every path and line below is as read in this working tree.

## A pattern's malformed `x` / `y` reads as a NaN origin
- where: packages/svg/src/patterns.ts:154 (readPlacement)
- scenario: `<pattern id="p" x="abc" data-weasel-tile="…">` (or `x=""`) → `parseFloat` gives NaN, `origin.x !== 0` is true, so the paint carries `origin: {x: NaN, y: NaN}` and the tile draws nowhere / poisons the renderer's tile math. An unreadable `x` should fall back to 0 (as every other length reader does, via `readLength`), with a warning.
- evidence: read
- severity: low

## A fill or stroke whose value is an unreadable function paints black instead of being dropped
- where: packages/svg/src/readPaint.ts:24 (readPaint); packages/svg/src/properties.ts:300 (unreadColor)
- scenario: `<g fill="red" stroke="blue"><rect … fill="rgb(255,0" stroke="color(foo 1 2)"/></g>`. `unreadColor` refuses to call a value holding `(` invalid, so the cascade keeps the declaration. `readPaint` then can't parse it, warns, and returns `{ kind: 'solid', color: '#000000' }`. The rect fills black and strokes black. A browser drops the invalid declaration, so the rect inherits red fill and blue stroke; with nothing to inherit, the stroke falls back to its initial `none`. Black is never `stroke`'s fallback, and it is only right for `fill` when nothing is inherited. Each branch should fall back to what the cascade gives without the declaration, i.e. the inherited or initial value.
- evidence: read
- severity: low

## An `<image>` without `width` / `height` imports as a zero-size box, silently
- where: packages/svg/src/readImage.ts:53 (imageNodeAt)
- scenario: An SVG 2 file holds `<image href="pic.png" x="10" y="10"/>`, which browsers draw at the bitmap's intrinsic size (`width`/`height` are `auto`). `readLength(boxEl, 'width', 'x', 0, …)` returns 0, so the node has width 0 and height 0 and draws nothing. No warning is given, whereas the absent `href` and `preserveAspectRatio` cases both warn. It should at least warn that the auto size isn't modeled, since this package never decodes the bitmap.
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

<!-- done: 3 findings, files read: 45 -->

