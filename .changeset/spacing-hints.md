---
'@weasel-js/guides': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Distance readouts and scene readers for equal spacing. `measureDistances(from, to)` returns the gaps between two boxes on each axis where they separate, or from an inner box to the edges of the one holding it, as `SpacingGap`s, with leader lines where a gap runs past its target. `distanceReadout()` is a surface contribution for `<SceneCanvas ambient>`: while Alt (or the `modifier` given) is held over a shape, it draws the distances from the selection to that shape. `siblingBounds`, `worldBoundsOf`, and `worldUnionOf` read world boxes off a scene; `siblingBounds` is what `alignMoveBehavior`'s `getSpacingTargets` wants while some ids move.

A modifier going down or up over a resting pointer now dispatches a `hover`, with the new modifiers, so a hover binding that needs a key held answers it without waiting for the pointer to move.

Core exports `scenePoseFrame` and `PoseFrame`: world reads and local writes over a scene's own composition.
