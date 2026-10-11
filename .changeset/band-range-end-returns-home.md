---
'@weasel-js/ui': patch
---

Dragging a `BandEditor` range end away and back to where it started left the end drawn at the previous pointer position and called `onRangeChange` with that range on release. The end now returns to its start, `onRangeInput` reports the original range, and release commits nothing.
