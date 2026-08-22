---
'@weasel-js/svg': patch
'@weasel-js/font': patch
'@weasel-js/core': patch
---

SVG import and export lose less on the way through, and installed fonts pick
one face per variant slot.

Paint servers are now found wherever they are declared, not just as direct
children of `<defs>`, and a gradient that inherits another's stops or geometry
through `href` / `xlink:href` resolves instead of coming back empty.
Percentages are read as ratios, so `x2="100%"` no longer means 100 bounds
units, and `gradientTransform` warns rather than silently painting elsewhere.

Three fidelity bugs in the round trip itself. A leaf's own `transform` was
decomposed against bounds that had already been through the inherited matrix,
so a rotation inside a translated `<g>` lost its rotation and moved. Any
stroke carrying `stroke-opacity` re-serialized with the attribute written
twice, which is not well-formed XML. And the computed `viewBox` was taken from
unrotated, untransformed geometry, cropping rotated content out of the export.

`<text>` now follows SVG's whitespace rules, so importing a pretty-printed
file no longer drags the source indentation into the document text; weasel's
own `<text>` carries `xml:space="preserve"` to keep real line breaks. A nested
`<svg x= y=>` places its children at that origin.

In the shared `d=` grammar, exponent coordinates (`M1e2 1e2`) no longer read
the `e` as a command, and arc flags written without separators
(`A5 5 0 0110 0`) no longer drop the arc.

`enableLocalFontOutlines` picks the least-qualified face when several installed
faces reduce to one (weight, style) slot, so "Helvetica Neue Condensed Bold"
stops displacing "Helvetica Neue Bold" depending on query order.

**Exported SVG bytes change**: `<text>` gains `xml:space="preserve"`, a stroke
writes `stroke-opacity` once, and a document containing rotated or
group-transformed content gets a larger computed `viewBox`.
