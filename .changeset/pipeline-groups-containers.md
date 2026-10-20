---
"@weasel-js/diagram": patch
---

`EffectEditor` edits a pipeline's groups. Under `nodeGraph` each group is a titled container: drag
a stage into or out of it, drag the box to carry what it holds (the stages, the boxes inside it,
and the routes of wires between them, as one `'Move'`), resize it (`'Resize group'`), or
double-click its title to rename it in place (`'Rename group'`). A resized box is stored in the new
`EffectDoc.groupBoxes`; a group with none fits its members, so older docs load unchanged. Under
`rack` and `lanes` groups draw as before. `selectedGroup` and `onSelectGroup` pick a group under
every look, and the ref gains `group`, `ungroup`, and `renameGroup`.

The edits are plain functions in `@weasel-js/diagram/effect`: `groupStages`, `ungroup`,
`renameGroup`, `moveToGroup`, `setGroupBox`, `moveGroup`, `groupContents`, and `nextGroupId`.
`removeStages` drops the box of a group it leaves empty, and no longer drops a group that was
empty before it ran. `EditorScene` gains `groupOf`.

`EffectEditor` now reports a drag's moves a microtask after `DiagramView` does, so that a group
box's move and the stage moves it carried arrive as one edit.
