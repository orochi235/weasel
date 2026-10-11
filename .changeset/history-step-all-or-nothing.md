---
'@weasel-js/history': patch
'@weasel-js/core': patch
---

An undo, redo, or `goto` whose op threw used to drop the entry from both stacks and leave the ops that had already run applied, so the edit could be neither undone nor redone. A step is now all-or-nothing: the ops that ran are inverted, the entry stays on the stack it was on, and the error still propagates. `applyOps` does the same for a batch that throws partway, and `scene.undo`, `scene.redo`, and `scene.jumpToHistoryIndex` also revert the scene writes of an op that threw partway through its own.
