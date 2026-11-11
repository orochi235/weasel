---
"@weasel-js/path-tools": patch
---

The Girth tool measures a width point at an open end with a retracted handle across the curve, as it does everywhere else; it used to fall back to a vertical normal there, so dragging that edge moved it sideways along the path. Clearing a width point is disabled with `NotApplicable` when there is no click and no set width point under the press in its params.
