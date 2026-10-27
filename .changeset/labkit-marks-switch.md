---
'@weasel-js/labkit': patch
---

Marks are a lab feature with a switch. In a lab with an instrument declaring `annotations`, View → Marks shows
and hides them: the targets' overlays, each trial's Marks section, export and mark undo, the overview's marks,
and the drawing tools in the rail. `<Lab marks={false}>` starts with them hidden, and a stored lab keeps the
last choice. Hidden marks are kept, and `useAnnotations` still reaches them. This adds API: the `marks` prop, and
`marks` / `setMarks` on `LabContextValue`, which a hand-built context value now has to supply.

An annotation target is asked for again when its element attaches or resizes, so a target sized by its own
element keeps up with it.
