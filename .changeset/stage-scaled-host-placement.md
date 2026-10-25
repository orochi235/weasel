---
'@weasel-js/labkit': patch
---

A `<Stage>` under a scaled ancestor (a lens, another stage) now reports its viewport to `onResize` in its own layout px, and a trial places its opening view, and goes home, against that size rather than its scaled client size. `<Orbit>`'s `onResize` keeps reporting client px, the space its gestures read.
