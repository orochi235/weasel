# Audit round 66: diagram-formats.drawXml

## HTML table cells in a cell's label run together with no separator
- where: packages/diagram-formats/src/drawXml/cellText.ts:7 (BLOCKS, htmlText)
- scenario: a draw.io HTML label holding a table, as its ER/class palettes write (`<table><tr><td>id</td><td>int</td></tr></table>`, `html=1`). `tr` breaks a line but `td`/`th` are neither a block nor a separator, and every other tag is stripped to nothing, so the row reads as one line `idint`. A browser lays the cells apart; the text should keep them apart (a space or tab between cells), not fuse the words.
- evidence: read
- severity: medium

## `<pre>` content in an HTML label loses its line breaks and spacing
- where: packages/diagram-formats/src/drawXml/cellText.ts:16 (htmlText)
- scenario: an `html=1` value `<pre>a\n  b</pre>`. The whitespace fold runs over the whole string before any element is looked at, so the newline and indentation inside `pre` collapse to one space and the label reads `a b` on one line, where a browser (and the draw app) shows two lines with the indentation kept. `pre` is even listed in BLOCKS, so the code knows the element but not its whitespace rule.
- evidence: read
- severity: low

## A moved edge label near the end of a line whose last stretch has no length falls back to the line's start
- where: packages/diagram-formats/src/drawXml/readStyle.ts:162 (pointAlong), readStyle.ts:195 (labelPlacementOf)
- scenario: an edge whose last bend sits on the target's center (line `[A, B, C, C]`) with a dragged label (`offset` point) at `x` near 1. `left` is reduced by subtraction, so on the second-to-last stretch it can exceed `l` by a rounding error; that stretch is skipped, the zero-length last one is skipped by `l === 0`, and the loop returns `undefined` although `total > 0`. `labelPlacementOf` then takes the self-loop branch and places the label at `line[0] + offset`, beside the source, instead of near the end. The last non-zero stretch should take any leftover.
- evidence: read
- severity: low

## Files read
packages/diagram-formats/src/drawXml/cellText.ts
packages/diagram-formats/src/drawXml/cells.ts
packages/diagram-formats/src/drawXml/format.ts
packages/diagram-formats/src/drawXml/mapping.ts
packages/diagram-formats/src/drawXml/pageCells.ts
packages/diagram-formats/src/drawXml/read.ts
packages/diagram-formats/src/drawXml/readPage.ts
packages/diagram-formats/src/drawXml/readStyle.ts
packages/diagram-formats/src/drawXml/style.ts
packages/diagram-formats/src/drawXml/write.ts
packages/diagram-formats/src/drawXml/writeEdge.ts
packages/diagram-formats/src/drawXml/writePage.ts
packages/diagram-formats/src/drawXml/writeStyle.ts
packages/diagram-formats/src/drawXml/writeXml.ts

<!-- done: 3 findings, files read: 14 -->
