---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

`@weasel-js/path-tools` adds three presets, each also in `pathTools`:

- `anchorSelectionPreset` selects anchors along the path in path edit. `growAnchorSelection` (`]`) adds each selected anchor's neighbors in its subpath and `shrinkAnchorSelection` (`[`) drops the anchors at the ends of each selected run, wrapping round a closed subpath. `selectEveryNthAnchor` (Alt+N) selects every `params.n`th anchor counting from the first selected one; `selectCornerAnchors` (Alt+C), `selectSmoothAnchors` (Alt+M), and `invertAnchorSelection` (Alt+I) select by anchor kind and by complement. They are in the `ANCHOR_SELECTION_GROUP` group, change only the selection, and push no undo step.
- `resamplePreset` brings `resamplePath`, an ongoing path command: it spreads each selected path's anchors evenly along it by arc length, to `params.count` anchors or at `params.spacing`, holds corner anchors fixed unless `params.keepCorners` is false, and refits the curves through the new anchors within `params.tolerance`, halving any piece that cannot follow the original that closely. It previews on `begin` and every update, and commits one undo step.
- `addExtremesPreset` brings `addExtremeAnchors` (Alt+X), which splits curved segments at their x and y extremes without moving the shape: the segments whose two ends are selected, or the whole path while no anchor is. It is in the `anchors` group.

`ActionParamSchema` types the params of `selectEveryNthAnchor` and `resamplePath`.

Core exports `livePathEdit`, the builder behind `simplifyPath` and `offsetPath`, for a path command driven live by its params. A live path command now recomputes when any param changes, not only its main number, and reads params a tuning supplies as a thunk.

`@weasel-js/geom` adds `resamplePath`, `addExtremaAnchors`, `segmentExtremaTs`, `cubicAxisExtremaTs`, and the selection walks `growAnchorSelection`, `shrinkAnchorSelection`, `everyNthAnchor`, `anchorsWhere`, `cornerAnchors`, `smoothAnchors`, and `invertAnchorSelection`.
