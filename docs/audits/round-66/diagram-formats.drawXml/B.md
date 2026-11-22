# Audit round 66 — diagram-formats.drawXml

## HTML table cells in a label run together: `<td>`/`<th>` are not block breaks
- where: packages/diagram-formats/src/drawXml/cellText.ts:7 (BLOCKS, htmlText)
- scenario: draw.io UML/ER shapes commonly hold an HTML table, e.g. value `<table><tr><td>id</td><td>int</td></tr></table>` with `html=1`. `tr`/`table` break lines but `td`/`th` are neither blocks nor separated, so `<[^>]*>` strips them and the row reads as `idint`. A browser lays the cells out apart; the text should keep a separator (or a line) between cells.
- evidence: read
- severity: medium

## `<pre>` content has its whitespace folded and its newlines dropped
- where: packages/diagram-formats/src/drawXml/cellText.ts:16 (htmlText)
- scenario: `html=1` value `<pre>a\n  b</pre>`: the first replace folds every whitespace run (including the newline) to one space before `pre` is seen, giving one line `a b`. A browser preserves whitespace and line breaks inside `pre`, so it shows two lines `a` / `  b`. The docstring claims the text is laid out "as a browser lays it out" and lists `pre` among blocks.
- evidence: read
- severity: low

## Placeholder values are substituted raw into an HTML label, so their `<`/`&` are parsed as markup
- where: packages/diagram-formats/src/drawXml/cells.ts:42 (filled) with cellText.ts htmlText
- scenario: `<object placeholders="1" label="%name%" name="a&lt;b&gt;c"><mxCell style="html=1;…"/>`: `filled` puts the attribute's decoded text `a<b>c` into the label, then `htmlText` strips `<b>` as a tag and the shape reads `ac`. A draw app escapes a placeholder's value before putting it into an HTML label, so it shows `a<b>c`. Likewise an `&amp;`-bearing value gets entity-decoded a second time.
- evidence: read
- severity: low

## Hollow `oval`/`box`/`classic` arrowheads read as filled with no warning
- where: packages/diagram-formats/src/drawXml/mapping.ts:119 (MARKERS_READ, markerOf)
- scenario: `endArrow=oval;endFill=0` (a common UML/ER hollow circle), `endArrow=box;endFill=0`, or `endArrow=classic;endFill=0`: these entries have no `hollow`, so `markerOf` returns the filled `circle`/`square`/`arrow-concave` and does not call `near`, so `markerAt` warns nothing. The import changes how the marker looks and says nothing. The `dash` entry shows the module's own rule: an approximation should report through `near`.
- evidence: read
- severity: low

## Exit/entry points snap to the nearest compass port with no warning
- where: packages/diagram-formats/src/drawXml/readStyle.ts:143 (portAt)
- scenario: draw.io's connection points include quarter points and corners, e.g. `exitX=1;exitY=0.25` or `exitX=0;exitY=0`, plus `exitDx`/`exitDy` offsets. `portAt` reads any of these as the nearest of `n/e/s/w` (a corner breaks the tie to `n`) and ignores the Dx/Dy offset. The connector then leaves from a different point than in the file, and no warning says so. Everywhere else in this module, a lossy mapping warns.
- evidence: read
- severity: low

## Underline and strikethrough bits of `fontStyle` are dropped silently
- where: packages/diagram-formats/src/drawXml/readStyle.ts:92 (textOf)
- scenario: `fontStyle=4` (underline) or `fontStyle=5` (bold+underline) or `8` (strikethrough): only bits 1 and 2 are read, and nothing warns about the rest. The text imports without its underline, and the file gives no sign of it.
- evidence: read
- severity: low

## Hidden cells and layers (`visible="0"`) are imported as visible
- where: packages/diagram-formats/src/drawXml/cells.ts:48 (rawCell) / pageCells.ts:127
- scenario: a draw.io page with a hidden layer, or a hidden shape (`<mxCell … visible="0">`): `visible` is never read, so the hidden layer's shapes and edges are merged into the page and drawn, and only "layers were merged" is warned. Content the author hid shows up in the import.
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

<!-- done: 7 findings, files read: 14 -->
