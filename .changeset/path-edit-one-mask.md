---
'@weasel-js/core': patch
---

Fixes: deselecting or deleting a node while its anchors were being edited left the anchors drawn but ungrabbable, kept shift-click from extending the selection, and made a drag on an anchor move the whole node. Whether a node is in anchor editing is now decided in one place: it exists, it is selected, and the mode allows it. The overlay, the selection outline, the chrome rules' `editingAnchors`, hit-testing, and the shift-click lock all read that answer. Selecting the node again resumes editing.

Changes behavior: an editing id supplied through `pathEdit` is held to the same rule, including the mode check, which the canvas used to skip for a host's id.
