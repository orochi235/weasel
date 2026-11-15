---
'@weasel-js/core': minor
---

A layer in the `layers` map that implements `hitTest` takes presses, as one registered with `registerLayer` does.

Slot layers are asked after every registered layer, topmost painted first, and still ahead of the selection chrome; an overlay still only paints. A `composeAffordanceLayer` layer now works in either place.

<!-- entry: new behavior -->
