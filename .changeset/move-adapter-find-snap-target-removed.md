---
'@weasel-js/core': major
---

`MoveAdapter` no longer declares `findSnapTarget`, which nothing in the kit called.

An adapter that implements it can delete it; snapping into a container is `snapToContainer`'s `findTarget`.

<!-- entry: breaking -->
