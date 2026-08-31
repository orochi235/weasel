---
'@weasel-js/core': patch
---

Drop four values the canvas layer memo no longer reads

`hit-test affordances against the painted chrome state` moved the selection
overlay to reading bounds off the chrome state at paint time, which left
`selectedIds`, `multiActive`, `previewToolPose` and `previewToolBounds`
referenced only by the `layers` memo's dependency array — nothing in the body
used them. Removing them from the array made all four dead locals, so they go
too.

The memo now rebuilds the layer array on layer/tool/geometry changes rather
than additionally on every selection and preview-pose change. Selection chrome
is unaffected: it repaints from chrome state, not from the identity of this
array.
