The findings file couldn't be written because the write permission wasn't granted, so here is the whole document:

# Audit round 65 — svg.part2 findings

## A fill or stroke that references a missing or dropped paint server paints solid black, where SVG paints nothing
- where: packages/svg/src/readPaint.ts:44 (readPaint)
- scenario: `readPattern` drops a `<pattern id="p">` with hand-drawn content (no `data-weasel-tile`, and not a lone `<image>`) at patterns.ts:103. The same happens when a `url(#nope)` names no definition at all. `<rect fill="url(#p)" stroke="url(#p)"/>` then imports with a black fill **and a black stroke**, because `defaultColor` is `#000000` for both (readPaint.ts:70 passes it for the stroke too). Browsers draw an unresolvable paint reference with no fallback as `none`. So the import draws a solid black shape, with an outline the source never had, where the source showed a pattern or nothing. It should return `{ kind: 'none' }` and keep the warning.
- evidence: read
- severity: medium

## A run whose stroke has zero width writes no stroke attributes, so its `<tspan>` takes the text's stroke
- where: packages/svg/src/strokeAttrs.ts:75 (coreStrokeAttrs), called from packages/svg/src/serializeText.ts:200 (runAttrs)
- scenario: a text node has `stroke: { paint: red, width: 2 }` and a run has `stroke: { paint: red, width: 0 }`. That is what `readTspanRun` produces for `<text stroke="red" stroke-width="2">a<tspan stroke-width="0">b</tspan></text>`.
  - The kit takes a run's stroke whole (`run.stroke ?? style.stroke`, packages/text/src/runs/resolveRuns.ts:254), so "b" draws with no stroke.
  - `coreStrokeAttrs` returns `[]` when `!(w > 0)`, and `strokeResets` writes no width reset, so the `<tspan>` has no `stroke-width`.
  - Every SVG reader, and the re-import, then strokes "b" 2 wide.

  When a run overrides a node stroke, a zero width has to be written out (`stroke-width="0"` or `stroke="none"`).
- evidence: read
- severity: medium

## A namespaced meta element's child in another declared namespace is stored under its local name only, then written back in its parent's namespace
- where: packages/svg/src/readMeta.ts:77 (collectNamespacedElement)
- scenario: with `namespaces = { a: A, b: B }`, take `<a:meta><b:item x="1"/><a:item/></a:meta>`.
  - Both children land in one `children.item` list, with no record of which namespace each came from.
  - `namespacedElementXml` (metaXml.ts:16) writes every child under the parent's prefix, so the export holds `<a:item x="1"/><a:item/>`.
  - The `b:` element has moved into namespace A, and anything reading `b:item` finds nothing.

  This breaks the lossless round trip that `NamespaceMeta` promises. Attributes got the same fix this week (265137cdd1); child elements still need it.
- evidence: read
- severity: low

## Every marker an import creates is registered globally and never released
- where: packages/svg/src/unpack.ts:187 (svgNodesToKitDrafts)
- scenario: `ingestMarkers` turns each `<marker>` definition it reads into an entry keyed `id-<hash>` (readMarkers.ts:306). For a `userSpaceOnUse` marker it creates one entry per stroke width and scale. `registerMarker` is called for each, and its disposer is thrown away. Nothing removes an entry once the nodes using it are deleted or undone, so importing many different files grows the global marker registry, and the paint memo it feeds, without bound.
- evidence: read
- severity: low

## The golden round-trip helper rounds tiny negatives to -0, which `toEqual` treats as different from 0
- where: packages/svg/src/testing/roundTrip.ts:71 (round)
- scenario: suppose a coordinate comes out `-1e-12` on the first parse and `+1e-12` on the second, from trig in a rotation or an arc converted to cubics. `round` turns them into `-0` and `0`. vitest's `toEqual` compares numbers with `Object.is`, so the fixture fails on a difference of 2e-12. readMarkers.ts:300 adds `+ 0` to avoid exactly this; this helper doesn't.
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

<!-- done: 5 findings, files read: 44 -->