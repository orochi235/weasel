---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Eight character-styling glyphs, and a text tool that declares its own options.

`bold`, `italic`, `underline`, `strikethrough`, `overline`, `superscript`,
`subscript` and `code` join the icon set. The five flags are letterforms
wearing the treatment they apply, because that is what the controls they label
replaced.

`useTextTool.options` declares the character half of text styling as a
`ToolPrefGroup`, keyed by `StyledRun` field, so a host reads a `RangeStyle`
into it and writes a `RunStylePatch` back with no name mapping. `short` moves
from `ToolPrefBoolean` to every leaf: it is the label any surface too narrow
for `name` shows, and `name` stays the accessible name.

`ToolOptionsBar` labels a bare value box — a number or a string — and leaves
every other control to say what it is, and it sizes fields and opacity tracks
for one line rather than for a panel column.
