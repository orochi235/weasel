---
'@weasel-js/core': patch
'@weasel-js/routing': patch
'@weasel-js/diagram': patch
'@weasel-js/labkit': patch
---

Every op factory's argument type can now be imported by name from `@weasel-js/core`: `InsertArgs`, `DeleteArgs`, `TransformArgs`, `ReparentArgs`, `SetDataArgs`, `SetLayerArgs`, `SetPathArgs`, `SetTextArgs`, `SetSelectionArgs`, `ReorderArgs` and `MoveToIndexArgs`, with the shapes they reference, `SiblingSlot`, `PlacedNode` and `ReorderRestoreEntry`. Core also exports `KeyBinding` (the parameter of `matchesKeyBinding`), `rangeWeight` and `unboldPatch`. `@weasel-js/diagram` exports `ForceBody`, the element type of `ForceRelaxation.bodies`.

The default align, distribute, boolean and edit icons are now marked `@experimental` on each component; the tag had sat on a file header where it marked nothing.

Breaking: `DispatcherViewTarget` and `ViewIdResolver` are off `@weasel-js/routing/react`. They moved to `@weasel-js/routing/internal`, which is not public API. `rectsEqual` is off `@weasel-js/labkit/surface`.
