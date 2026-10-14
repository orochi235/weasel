---
'@weasel-js/core': patch
---

Path commands as kit actions, in the `paths` feature preset. `simplifyPath` and `offsetPath` are ongoing actions driven by one number — `tolerance` and `distance` — so a slider can preview them live with `useOngoingAction` and commit once: Simplify refits each selected path in place, and Offset Path adds the grown or shrunk outline beside each, behind its source when grown and in front when shrunk, and selects the new paths. `snipAtCrossings` (Cut at Crossings) replaces each selected path with its pieces wherever another selected path crosses it. `joinPaths` (Cmd/Ctrl+J) closes a selected open path or joins two at their nearest open ends. In path edit, `joinAnchors` (Cmd/Ctrl+J) joins the two selected end anchors and `averageAnchors` (Cmd/Ctrl+Alt+J) moves the selected anchors to their mean, with variants that average one axis only. The object commands are in a new `path` group; the anchor ones join the `anchors` group.

These commands drop a node's `skin` and shape generator, since the new geometry has neither the anchors the skin follows nor the shape the generator makes. The geometry behind them — `simplifyPath`, `offsetPath`, `snipPathsAtCrossings`, `averageAnchorsAt`, `joinAnchorsAt` — is exported too.
