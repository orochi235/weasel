---
'@weasel-js/core': minor
---

`snapToContainer` shows the dragged nodes in their slot as soon as the dwell elapses, even with the pointer held still.

Move and clone set the new `GestureContext.refresh`, which runs the gesture's frame again at the pointer's last place for a behavior whose answer changed between moves.

<!-- entry: fix api -->
