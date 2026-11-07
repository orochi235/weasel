---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

Keys that edit the document now wait for an in-flight gesture to end, as Delete and the arrow nudges already did. Pressed mid-drag, Transform Again and Duplicate made copies, Flip turned what was being dragged, Group and Ungroup reparented it, the arrange keys reordered it, Undo and Redo replayed history under it, and the path and anchor joins rewrote it, all before the release committed the drag over the result.

`@weasel-js/routing` exports the phase these bindings carry as `BETWEEN_GESTURES`, the one the offhand tools and mode shortcuts already used.
