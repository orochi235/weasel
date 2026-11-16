---
'@weasel-js/routing': minor
'@weasel-js/core': minor
---

`scrolledPlaceOf(el, scroller)` gives where an element sits in a scroller's content, in the scroller's own px.

It divides out any scale an ancestor transform draws the two at, so the answer can be written to `scrollTop` or a style as it is.

<!-- entry: api -->
