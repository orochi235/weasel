---
"@weasel-js/core": patch
"@weasel-js/path-tools": patch
---

An edit action that would change nothing reports itself disabled (`NotApplicable`) instead of enabled.

That covers `deleteAnchors` where the path refuses the delete, such as one anchor of a two-anchor line; `constrainAnchors` where the selection makes no constraint of its kind; `unconstrainAnchors` where there is none to remove; `setCorners` without a shape or radius, or with the ones the corners have; and the anchor nudges and `reversePath` where the selection names no anchor of the path. Selection commands stay enabled when their result is the current selection.

<!-- entry: behavior fix -->
