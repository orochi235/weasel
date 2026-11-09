---
'@weasel-js/renderer': patch
'@weasel-js/text': patch
'@weasel-js/text-dom': patch
---

Fixes to pattern tiles, text bounds, markdown layout and pasted tables.

- A `chunks` tile whose `chunkSize` is zero, negative or NaN, or whose `density` is infinite, scatters no chunks. Before, a zero size looped forever building the tile and hung the page, and a negative one threw from the canvas. A `dots` tile with a negative or NaN `radius` draws no dot rather than throwing.
- A text command's painted bounds reach each glyph's pen step as well as its advance, so a retained group no longer cuts off the end of an underline, strikethrough or overline that letter spacing carries past the last letter.
- `layoutMarkdown` measures its width without spreading every line into one call, which overflowed the stack on a text of a million lines or so.
- A pasted table row keeps a tab for each empty cell before a cell with text, so `a`, an empty cell and `b` paste as `a\t\tb` rather than `a\tb`.
