---
'@weasel-js/routing': patch
---

Shift+wheel steps the active tool's `size` option: up grows it, down shrinks it.

It is bound as `<tool>.wheelSize` for any tool whose options name a `size`, and while that tool is active it outranks the viewport's Shift+wheel sideways pan. The first event of a burst steps at once, so one mouse-wheel notch is one step; a trackpad's stream of small deltas steps once per 60 px of travel. It reads `deltaX` when `deltaY` is 0, since macOS sends a mouse's Shift+wheel as a horizontal one.

<!-- entry: rank=10 new api -->
