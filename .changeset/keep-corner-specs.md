---
'@weasel-js/geom': patch
'@weasel-js/stroke': patch
---

Booleans, Trim segment, Cut at crossings, and Offset path keep corner specs. Each works on what a path draws, its corners cut and spanned, and then folds every corner it left whole back into its anchor and spec, so the corner stays editable as a corner; a corner the operation cut into or moved stays as plain geometry. `keepCorners` and `restoreCorners` are the shared step, `cornerTraces` and `cornerCuts` say what each corner draws.

Booleans used to ignore corner specs entirely and work on the sharp anchors. They now work on the rounded shape.

Offset path keeps a corner where its offset is the same corner again, moved to where the offset edges meet and resized about the same center (`offsetCornerTraces`): a round corner at a right angle grows its radius by the distance. A corner whose offset is no longer its shape stays as plain geometry. At distance zero every corner is kept.

`simplifyPath` no longer throws on a subpath with two coincident anchors.
