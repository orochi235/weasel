---
'@weasel-js/labkit': patch
---

An instrument that lists `layers.toggle` or `layers.reorder` in `undo.snapshotOn` now gets an undo step when a layer is shown, hidden, or reordered; before, those two events reached nothing. Breaking: `createEventBus`, `EventBus`, and `EventListener` are removed from `@weasel-js/labkit` and `@weasel-js/labkit/undo`. The trial created a bus and published to it, but nothing ever subscribed, and undo snapshots never went through it. `ctx.emit` and `undo.snapshotOn` work as before.
