---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Escape cancels a drag. `startThresholdDrag` ends a live drag as a cancel when Escape is pressed, and keeps that key press from anything else listening, so a drag inside a dialog does not also close it. Everything built on it follows: `Tree`, `useReorderDragList`, and the rows of `PrefSchemaEditor`'s live preview. The editor's palette now drags through `startThresholdDrag` too, so a press on a tool that never moves makes nothing.

In `PrefSchemaEditor`, dropping a node where it already sits no longer adds a step to undo.
