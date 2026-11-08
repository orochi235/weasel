---
'@weasel-js/diagram': patch
---

Fix connector edge cases in `@weasel-js/diagram`.

- A self-edge that names a port at only one end now loops around a corner from that port. Before, it drew a zero-length edge or a line straight through its node.
- `commitReconnectToScene` now moves the edge and its labels onto the page both ends share, or into the page run, the same way a connect does.
- The avoid router no longer hangs when `margin` is 0 or less.
- The avoid, label placement, line-jump and off-page passes now skip locked connectors and labels. Before, moving a shape near one threw an error and the move failed.
