---
'@weasel-js/text': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

A text node's `data.fill: null` is now an explicit no-fill, so stroked-but-
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
