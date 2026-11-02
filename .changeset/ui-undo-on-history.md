---
'@weasel-js/ui': patch
---

`LayeredCurveEditor`'s built-in undo and the Badge compose lab's undo now run on `@weasel-js/history`,
which `@weasel-js/ui` lists as a dependency. The keys, the depth kept (100 steps in the editor, 200 in
the lab) and the lab's merging of a scrub into one step are unchanged. In the lab, a redo pressed while
a change is still settling now records that change first, which leaves nothing to redo, where before it
redid the older step and lost the change.
