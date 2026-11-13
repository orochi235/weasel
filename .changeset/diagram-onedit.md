---
'@weasel-js/diagram': minor
---

`DiagramView` takes `onEdit`, which hears one gesture's moves, routes and container edits together as one `DiagramEdit`.

A container dragged with its members reaches `onMove` and `onEditContainer` as separate reports; `onEdit` gets them as one, a microtask after the last, so a host can store the drag as one undo entry. Setting it turns on dragging and container editing as those two do.

<!-- entry: rank=5 api new -->
