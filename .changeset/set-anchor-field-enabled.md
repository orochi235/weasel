---
'@weasel-js/path-tools': patch
---

`setAnchorField` is disabled for an entry that would change nothing.

That covers the value the anchors already hold, a handle field the anchor has no handle for, a non-finite number, and a selection naming no anchor of the path.

<!-- entry: fix -->
