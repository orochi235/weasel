---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

Path edit can select anchors along the path. `growAnchorSelection` (`]`) adds each selected anchor's neighbors in its subpath and `shrinkAnchorSelection` (`[`) drops the anchors at the ends of each selected run, wrapping round a closed subpath. `selectEveryNthAnchor` (Alt+N) selects every `params.n`th anchor counting from the first selected one; `selectCornerAnchors` (Alt+C), `selectSmoothAnchors` (Alt+S), and `invertAnchorSelection` (Alt+I) select by anchor kind and by complement. They are in the `anchorSelection` group, change only the selection, and push no undo step.

`resamplePath` is a new ongoing path command: it spreads each selected path's anchors evenly along it by arc length, to `params.count` anchors or at `params.spacing`, holds corner anchors fixed unless `params.keepCorners` is false, and refits the curves through the new anchors within `params.tolerance`, halving any piece that cannot follow the original that closely. It previews on `begin` and every update, and commits one undo step.

`addExtremeAnchors` (Alt+E for selected segments, Alt+Shift+E for the whole path) splits curved segments at their x and y extremes without moving the shape; it is in the `anchors` group with a variant per scope. All three families are in the standard actions and the `paths` feature, and `ActionParamSchema` types the params of `selectEveryNthAnchor`, `addExtremeAnchors`, and `resamplePath`.

With no mode registry, Delete and the arrow keys in path edit now act on the selected anchors, and a drag on empty canvas marquee-selects anchors. Each used to reach its node-level twin first, so Delete removed the whole path.

A live path command (`simplifyPath`, `offsetPath`, `resamplePath`) now recomputes when any param changes, not only its main number, and reads params a tuning supplies as a thunk.

`useOngoingAction` commits an edit left open at unmount a microtask later, so StrictMode's rehearsal unmount no longer commits an edit opened in an effect.

`@weasel-js/geom` adds `resamplePath`, `arcRun`, `addExtremaAnchors`, `segmentExtremaTs`, `cubicAxisExtremaTs`, and the selection walks `growAnchorSelection`, `shrinkAnchorSelection`, `everyNthAnchor`, `anchorsWhere`, `cornerAnchors`, `smoothAnchors`, and `invertAnchorSelection`.
