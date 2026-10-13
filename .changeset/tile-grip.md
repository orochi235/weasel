---
'@weasel-js/labkit': patch
---

`<TileGrip>` makes any `<Workspace reorderable>` tile draggable: a `div` a drag of its tile starts from, and a plain `div` where the tile cannot be moved. Since a trial's title bar became the drag surface, a tile that was not a `<Trial>` had nothing to be dragged by. The title bar is now a `TileGrip`, and no longer carries the `lk-trial__titlebar--draggable` class.
