---
'@weasel-js/labkit': patch
---

Cmd/Ctrl+Z and its redo forms pressed while typing in a text field inside a trial (a settings field, an input the instrument renders, one in an undocked panel) stepped the trial's undo history and blocked the field's own undo. The trial now leaves those chords to a text field, a textarea, or editable content, and still answers them from a slider, a checkbox, or a button. It also leaves alone a chord something inside the trial has already handled.
