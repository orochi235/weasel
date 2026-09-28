---
"@weasel-js/core": patch
---

The `align.*` actions take a `to` param and `flip` takes new `pivot` values,
naming what the selection lines up against: `'union'` (the selection itself —
align's default), `'pointer'` (the click's world point, else the `pointer`
dep's latest position), a world point or rect `{ x, y, width?, height? }`, or a
key node `{ node: id }`. Bind `{ to: 'pointer' }` to a key and the selection
aligns to wherever the cursor is. `useAlign`'s `align(edge, to?)` takes the same
reference. New exports: `AlignReference`, `alignTargetBounds`,
`SpatialReference`, `SpatialReferenceSources`, `resolveSpatialReference`,
`FlipAxis`, `FlipPivot`.

The align actions are now enabled with one item selected, since any reference
but `'union'` can align a single item; with `'union'` and one item they do
nothing, as before.
