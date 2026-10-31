---
'@weasel-js/path-tools': patch
'@weasel-js/core': patch
'@weasel-js/history': patch
---

The Smudge brush now smudges text: a text node it may push (selected, or any unlocked, shown one while nothing is
selected) is converted to outlines, as Create Outlines does, the moment the brush touches it, and its paths are
smudged from then on. Conversion and smudge are one undo entry labeled "Smudge brush", and Escape mid-stroke puts the
text back. Text whose face has no outlines is left alone, and the user is told once per stroke. In a host with no
`createOutlinesAdapter` dep, text is skipped. A selected group is now smudged as its path leaves.

`applyCreateOutlines(adapter, ids?)` converts the given text nodes rather than only the selection.

A journal can now open inside another (`Journal.beginJournal`), and `scene.history.beginJournal` opens inside the
journal edits are going to when there is one, so a gesture journaled during a mode lands in the mode's journal as one
entry. A journal opened on `scene.history` now takes the scene's `applyBatch` edits without an active-journal accessor.

New `notices` dep (`NoticesDep`, published with `useNotices`): where an action tells the user something went wrong.
Create Outlines, Outline Stroke, Pathfinder, and the Smudge brush report text they cannot outline through it, and fall
back to the console without it.
