---
'@weasel-js/core': patch
---

`usePointerStylus` holds a throttled sample for the whole gap of a `maxFps` low enough to space commits more than 2³¹ − 1 ms apart, instead of committing it at once.

<!-- entry: fix -->
