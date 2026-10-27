---
'@weasel-js/diagram': patch
---

A member of a `DataContainer` marked `reorder` can now be dragged out of it: the reorder drag hands off to the move once the pointer leaves the container's box, and `onMove` reports where it lands. A group's members still only reorder. Adds `ReorderOptions.region`, the box a reorder drag stays a reorder in.
