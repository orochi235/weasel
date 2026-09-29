---
"@weasel-js/text": patch
"@weasel-js/core": patch
"@weasel-js/svg": patch
"@weasel-js/ui": patch
---

Add justified text. `TextAlign` gains `'justify'`: every line that wraps is
spread across the box by widening its word gaps equally, and a paragraph's last
line, or a line with no gap, sits at the start edge. `resolveAlign` maps
`justify` to that start edge. `LayoutRunsOpts.justify` and
`TextDrawCommand.justify` carry justification apart from the edge, so
`justify: true` with `align: 'center'` centers the last lines instead (CSS
`text-align-last`). The edit overlay sets `text-align: justify` and pins
`text-align-last` to the same edge, and the property panel's Align bar gets a
Justify segment with a new `textAlignJustify` icon. SVG export writes a
justified node at its start edge and records `data-weasel-align="justify"`,
which the reader turns back into `align: 'justify'`.

This is additive. Code that switches over `TextAlign` exhaustively has a new
value to handle.
