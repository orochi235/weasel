---
"@weasel-js/geom": patch
"@weasel-js/ui": patch
---

`SwatchGrid` and `SwatchStrip` follow a curve. Inside an `Along`, or given a curved `shape`, each row of swatches lies on a ring of its own, every next row one row further in toward the curve's center, so a palette reads like a color wheel's rim. `SwatchStrip` puts the recent colors on the outer rings and the palette on the rings inside them, each section's heading — or the palette picker, when there is more than one palette — first on its section's first ring. Left and Right move along a ring and Up and Down between rings, as they move across and between rows in the grid. A ring too long for its arc scrolls along itself, as a curved `Bar` does; where the curve bends too tight for another ring to keep its swatches apart, the rest of that palette's rows share its last ring. Outside a curve both render as before. Both take `shape` and `align` props, as `Bar` does.

In geom, `shiftTrack(shape, shift)` is the track that lies a fixed distance along a shape's normal from it, addressed by its own length, or null where that distance passes a center of curvature and the track would fold; `bendSide(shape)` says which side of its normal a shape bends toward.
