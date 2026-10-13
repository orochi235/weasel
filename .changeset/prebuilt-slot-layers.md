---
'@weasel-js/core': patch
---

Fixes: a pre-built layer (`{ layer }`) in `<SceneCanvas layers>`'s `selectionOverlay` slot typechecked and was never painted; the kit's own overlay was built from the defaults instead. It now paints in the overlay's place, with no rotate badge of the kit's.

Adds API: the `scene` slot takes a pre-built layer too, which paints the scene in place of the per-layer canvas layers the kit builds, under the `scene` anchor. A gesture in flight draws no ghost over it, since the ghost is painted with the slot's `drawOne`. `mergeLayersWithDefaults` leaves a pre-built layer in either slot as it was given.
