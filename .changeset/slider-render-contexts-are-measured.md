---
'@weasel-js/ui': patch
---

A `Slider`'s custom thumb is handed the box it is laid out in and `isActive: true` while it is the one being dragged; it was always told 14 by 24 and never active. `renderTrack`'s `trackWidth` is the track's measured width from the first paint and follows a resize. The dragged thumb also carries the stylesheet's active class, which raises it over its neighbors.
