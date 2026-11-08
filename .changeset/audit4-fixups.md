---
'@weasel-js/labkit': patch
'@weasel-js/diagram': patch
'@weasel-js/core': patch
---

Fixes left from the third audit round:

- labkit: calling a `watch3d` unsubscribe a second time does nothing; it could delete a listener set registered later for the same trial.
- labkit: `PresentationState.time` and `labkit:seek`'s `time` are documented as what they are, shown time: the clock's `origin` plus the time into the pass.
- diagram: adding an edge label with the default double-click edit and committing its first text are one undo entry, so an undo after typing takes the label away instead of leaving it empty and invisible. `dropEmptyEdgeLabel` removes an emptied new label within that entry.
- core: `textEditJoin(id)` gives a batch that makes a node for a text edit the options that let the edit's commit join its undo entry. `useSceneTextEdit` ends that run when the edit ends, so a later edit of the node stays its own entry.
