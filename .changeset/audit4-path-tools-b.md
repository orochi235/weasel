---
'@weasel-js/path-tools': patch
---

Fix path tools found in an audit:

- A warp drag or pin that makes no warp no longer leaves an undo entry holding only the text it converted to outlines.
- A balance grip dragged back to where it was pressed now commits nothing, instead of the shape from the move before.
- Extend to next path in path edit now commits through path edit, so what path-edit extensions keep per anchor follows the anchors, and a selected end stays selected on the new end.
- Canceling an Add spiro point drag puts the anchor selection back as it was, instead of clearing it.
