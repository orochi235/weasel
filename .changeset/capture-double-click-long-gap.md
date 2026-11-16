---
'@weasel-js/routing': patch
---

`captureGesture` holds a click back for the whole of a `doubleClickMs` longer than 2³¹ − 1 ms, instead of taking it as a single click at once.

<!-- entry: fix -->
