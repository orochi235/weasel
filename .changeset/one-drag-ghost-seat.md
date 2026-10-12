---
'@weasel-js/gestures': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

The three drag ghosts mount in one place. `fixedSeat(from)` in `@weasel-js/gestures` answers where a `position: fixed` element following the pointer mounts (the nearest themed or `data-wzl-portal-host` ancestor of `from`, else the body) and the client point its corner lands on when that host contains its fixed descendants. `nearestPortalHost` moved there from ui, which still exports it.

- core: the default `useDragHandle` ghost mounts in the source's host, where it mounted on the body, so it resolves the source's theme and draws in its font.
- ui: `<DragGhost>`'s `at.width` is optional; with none the ghost is as wide as what it holds.
- labkit: a palette drag's ghost is ui's `<DragGhost>`, so it takes the lab's theme. **Breaking:** `DragState` and `DragGhostProps` gain a required `from`, the element the drag began on, and the ghost loses its own border.
