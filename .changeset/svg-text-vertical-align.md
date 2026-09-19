---
'@weasel-js/svg': patch
---

A text node's vertical alignment now survives an SVG round-trip. `SvgTextNode` gains `verticalAlign`, written as `data-weasel-vertical-align` beside `data-weasel-width` / `data-weasel-height` and read back by `parseSvg`; `svgNodesToKitDrafts` carries it onto the `kit:text` leaf's `data.verticalAlign`. Previously an export dropped it and a re-import came back top-aligned. Other SVG readers still draw the text at the top of its box, since SVG text has no box to align within. Additive.
