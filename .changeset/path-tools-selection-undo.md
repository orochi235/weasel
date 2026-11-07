---
'@weasel-js/path-tools': patch
---

The path-effect commands (applying an effect, Expand, Set and Release Spine, Set and Release Effect Path) and Trim put their selection change in their own undo entry, through `commitOps`'s `select`. Undo now restores the selection they started from under a consumer's `applyOps` history, where it used to leave their result selected. An `applyOps` adapter sees a `setSelection` op at the end of these batches.
