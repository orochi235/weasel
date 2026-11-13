---
'@weasel-js/path-tools': patch
'@weasel-js/core': minor
---

The Spiro tool closes a curve within the pen's close reach, the `targets.penCloseHitPx` kit setting, when no `closeHitRadius` is given.

Core exports that setting's default as `PEN_CLOSE_HIT_PX`.

<!-- entry: fix api -->
