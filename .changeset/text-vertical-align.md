---
'@weasel-js/core': patch
---

`kit:text` nodes take a `verticalAlign`, and picking follows it.

Centering a glyph in its box meant nudging `pose.y` by hand and re-deriving the
nudge whenever the font size changed. The painter forwarded the pose's height
but never an alignment, so the box the renderer aligned within was always
resolved as `'top'`.

`data.verticalAlign` — `'top' | 'center' | 'bottom'`, the same spelling the draw
command already took — now reaches both halves: the paint command and the
silhouette `textLineBoxes` builds, so a centered block is grabbable where it
draws rather than where a top-aligned one would have. A node that names none
paints exactly where it did before.
