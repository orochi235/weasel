---
"@weasel-js/ui": patch
---

Add `ItemList`, the row chrome behind a sidebar list.

WeaselDraw's Layers and History panels each carried a private copy of the same
container / row / empty-state CSS, and they had drifted: rows were 28px against
24px, and Layers was pulled 8px wider on both sides by a negative-margin class,
so two lists stacked in one sidebar did not line up. Both now render through
`ItemList` and agree by construction.

It owns the container, the row box and the empty state, and nothing else. What
a row means stays with the consumer, reached through `className` and
`rowProps` — history dims its redo entries and rules a line under the current
one; the layer list drags to reorder, leads each row with a swatch, and hangs
its drop indicator off `overlay`.
