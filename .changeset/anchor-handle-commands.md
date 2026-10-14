---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Path edit has two commands for the selected anchors' handles. `retractHandles` collapses them onto their anchors, making sharp corners; a segment whose ends both lose their handles turns straight. `makeHandlesSymmetric` gives each anchor two handles of equal length pointing opposite ways, making it smooth: the shared direction splits the difference between the two handles' own, the shared length is their mean, and an anchor with one handle mirrors it. The ends of an open path are skipped. Both are in the standard actions and the `paths` feature preset, in the `anchors` group, with icons `RetractHandlesIcon` and `SymmetricHandlesIcon`, and are disabled when they would change nothing.

Dragging a control handle with Shift held keeps it at the angle it had at the press and changes only its length; it can shrink onto its anchor but not flip through it.

`@weasel-js/geom` adds the edits underneath: `retractHandles(set, flatIndexes)`, `makeHandlesSymmetric(set, flatIndexes)`, and `handleAlongItsAngle(anchor, handle, to)`.
