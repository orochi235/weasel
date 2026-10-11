---
'@weasel-js/geom': patch
---

`trimPolyline` emitted its first point twice when the start inset landed exactly on a vertex, leaving a zero-length segment at the head of the trimmed stroke.
