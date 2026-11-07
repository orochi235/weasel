---
'@weasel-js/renderer': patch
---

`blur()` with an infinite or NaN radius draws the group unblurred. Its taps were spaced at NaN, so the group came out blank, and its reach was unbounded, so every frame ran the passes over the whole drawing buffer.
