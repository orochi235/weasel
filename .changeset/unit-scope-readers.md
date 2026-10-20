---
"@weasel-js/core": patch
"@weasel-js/guides": patch
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
"@weasel-js/kernel3d": patch
"@weasel-js/quantity": patch
---

A container's unit scope (`ContainerNode.units`) now reaches grid snapping and node property
fields. A scope converts what is shown, typed and snapped to; every pose is still stored in world
units, and pose composition does not scale by it.

- `gridSnapSource({ scopes: { root, spacing? } })` snaps the subject on the pitch of the unit
  scope its nodes share, so a node inside a millimeter sub-assembly snaps on millimeter spacing.
  `spacing` is read in that scope's units unless `scopes.spacing` gives a pitch per scope.
  `scopedGridPitch` answers the pitch for a chain of scopes.
- A snap source is told the gesture's subject: `SnapCollect.ids`.
- `sceneSharedUnitScopes(scene, ids, root)` is the run of unit scopes every node of `ids` sits in.
- A number leaf takes `measure: 'length'` for a length stored in world units.
  `prefLeafInScopes(leaf, scopes)` gives such a leaf the unit of the scopes it is shown in, built by
  `scopedPrefUnit(scopes)`: shown in the innermost scope's base unit, with every unit of its system
  accepted as typed text. The kit's node schemas mark X, Y, W, H and text padding as lengths.
- `SelectionPanel` takes `units`, the scene's outermost scope; given it, a length field shows the
  selected nodes' shared scope.
