---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A press on a single-thumb `Slider`'s track now jumps the thumb to that point, snapped to the step, and keeps dragging from there; the thumb takes focus, so the arrow keys carry on from the new value. labkit's zoom control and config sliders get it through `Slider`. A `Slider` with several thumbs still ignores a track press unless `trackClick: 'move-nearest'` is set, and `trackClick: 'none'` turns the jump off on a single thumb.
