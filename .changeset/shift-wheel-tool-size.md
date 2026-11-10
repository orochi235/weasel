---
'@weasel-js/routing': patch
---

A tool whose options name a `size` now also steps it with Shift+wheel while it is the active tool (`<tool>.wheelSize`): up grows it, down shrinks it. The first event of a burst steps at once, so one mouse-wheel notch is one step; a trackpad's stream of small deltas steps once per 60 px of travel. It reads `deltaX` when `deltaY` is 0, since macOS sends a mouse's Shift+wheel as a horizontal one. While such a tool is active, its binding outranks the viewport's Shift+wheel sideways pan.
