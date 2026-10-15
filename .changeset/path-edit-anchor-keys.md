---
'@weasel-js/core': patch
---

Delete, Backspace, and the arrow keys in path edit now act on the selected anchors in a `<SceneCanvas>` with no mode registry. They used to delete or nudge the whole shape, because the node-level `delete` and `nudge.*` actions were registered ahead of `deleteAnchors` and `nudgeAnchors.*` and took the keystroke. The anchor actions now register first and still decline when no anchor is selected, so the same keys reach the node then.
