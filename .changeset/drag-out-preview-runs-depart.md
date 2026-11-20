---
'@weasel-js/editing': patch
---

Dragging a child out of a layout container previews its siblings where the drop will leave them.

The preview runs the container's `depart` when its strategy has one, as the commit does.

<!-- entry: fix -->
