---
'@weasel-js/labkit': minor
---

An annotated instrument mounts any number of targets at once; past about two dozen, the page died with "Maximum update depth exceeded".

A `TilePainter` handed to `registerPainter` now runs inside one `flushSync` with every other painter of its frame, and may return a function to run once their state has committed, where it used to call `flushSync` itself.

<!-- entry: fix api -->
