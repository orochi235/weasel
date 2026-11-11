---
"@weasel-js/ui-input": patch
---

`@weasel-js/ui-input` exports `edgePush` and `edgeScroll`, how hard a drag near a scrolling box's edge pushes it to scroll.

`edgePush(span, p, margin)` is -1 to 1 along one axis: 0 until the pointer is within `margin` of an end, full strength at the end and past it. `edgeScroll(bounds, point, margin)` reads both axes of a box. Multiply by a top speed for how far to scroll.

<!-- entry: new api -->
