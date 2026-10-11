---
'@weasel-js/core': patch
---

`snapBackOrDelete` and `snapToContainer` act on every dragged node. With several nodes dragged, a far release under `onFreeRelease: 'delete'` used to delete the first and spring the rest back; it now deletes them all. `snapToContainer` used to reparent only the first and return the rest to where they started; it now reparents each one, asking `findTarget` for that node's own slot, and a node with no slot in the snapped container lands where the drag previewed it.
