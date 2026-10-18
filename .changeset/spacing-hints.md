---
'@weasel-js/guides': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Spacing hints, as one preset. `createSpacingHintsPreset()` is a `<SceneCanvas features>` entry: a move snaps the selection so its gap to a neighbor equals one already between its siblings and marks the equal gaps, and holding Alt over a shape measures its distance from the selection. Options turn off the spacing snap or the readout, add snapping to siblings' edges and centers, and set the snap distance and color. Turning it off is leaving it out of `features`.

A `FeaturePreset` can now carry `moveBehaviors`, folded into every move the presets' ambient bindings run, after the select tool's own.

The pieces are exported too. `measureDistances(from, to)` returns the gaps between two boxes on each axis where they separate, or from an inner box to the edges of the one holding it, as `SpacingGap`s, with leader lines where a gap runs past its target. `distanceReadout()`, which the preset brings, is a surface contribution for `<SceneCanvas ambient>`: while Alt (or the `modifier` given) is held over a shape, it draws the distances from the selection to that shape. `siblingBounds`, `worldBoundsOf`, and `worldUnionOf` read world boxes off a scene; `siblingBounds` is the boxes equal spacing measures while some ids move.

A modifier going down or up over a resting pointer now dispatches a `hover`, with the new modifiers, so a hover binding that needs a key held answers it without waiting for the pointer to move.

Core exports `scenePoseFrame` and `PoseFrame`: world reads and local writes over a scene's own composition.
