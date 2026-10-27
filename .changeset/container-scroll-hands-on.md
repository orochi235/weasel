---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

A container's wheel scroll hands the wheel on at the end of its range. Scrolled as far as it goes in the wheel's direction, `containerScrollAction` passes the wheel to the scrollable container holding it, and past the outermost one to the viewport's wheel pan. Before, a scrollable container kept every wheel over it, even with nowhere left to go.

`scrollRange` now measures in the container's own frame, the axes its scroll offset runs along, so a turned container scrolls by its own length rather than its axis-aligned box's, and `scrollableAt` takes a point only over a turned container's own area. Under a composition without `scroll`, or for a container whose pose is not a frame, `scrollRange` answers `null`, since neither can scroll.

An immediate invoker's `run` may now return `'pass'`: the dispatcher walks on to the next matching binding as though `enabled()` had declined, and `ActionsRegistry.trigger` answers `false`. This adds API; a `run` returning nothing behaves as before.
