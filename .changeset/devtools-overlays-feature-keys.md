---
'@weasel-js/devtools': patch
---

A devtools `set-overlays` request naming anything but a debug feature is refused rather than crashing the canvas's overlay. `{ highlight: true }` or `{ theme: true }` no longer reaches the canvas's debug config.

<!-- entry: fix -->
