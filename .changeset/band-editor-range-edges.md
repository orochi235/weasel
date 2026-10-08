---
'@weasel-js/ui': patch
---

`BandEditor` can rescale its whole range. Pass `onRangeChange(min, max, bands)` and both ends of the strip become draggable, keyboard-operable sliders. Dragging an end rescales the sequence with the other end held: every band stretches or shrinks in proportion to its length as drawn. Pull an end past the track and the axis squeezes to fit while the drag is live. Ends stop outward at `limits` when given. `onRangeInput` previews the drag.

A band can be locked: right-click it, or select it and press `l`. A locked band (`Band.locked`) is hatched, and holds its length while the rest of the range rescales around it. Locking is offered only when `onRangeChange` is wired, since it affects nothing else.

Ticks outside the drawn axis are now hidden rather than piled at its ends.
