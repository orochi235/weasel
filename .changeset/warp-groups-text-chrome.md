---
'@weasel-js/path-tools': patch
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

The warp tools (Distort, Envelope, Puppet Warp) now work on a selected group: one set of controls is laid around all
of its paths, and they warp together. Selected text converts to outlines when a warp begins on it (a drag on the fresh
controls, or a pin placed), conversion and warp landing as one undo step; canceling the drag puts the text back, and
text whose face has no outlines is left alone with a notice. While a warp tool is active, the selection's resize and
rotation handles no longer draw over its controls or take its presses.

New `ToolDef.hides`: chrome ids hidden, in paint and hit-test alike, while that tool is the active one (carried to
rules as `RuleCtx.hiddenChrome`).
