---
'@weasel-js/ui': patch
---

`GradientEditor` edits one stop at a time. Each stop is a handle on the track drawn in its own color, over a checker where the color is translucent, and the ramp is painted over the same checker. One stop is selected, by a press or by focus, and a single row under the track edits it: position as a percentage, color, opacity, and a remove button. The editor is the same height at nine stops as at two. A press on bare track adds a stop and selects it; the arrow keys move a focused handle, and Delete or Backspace removes it.

Breaking: the row of one `ColorField` per stop is gone, and with it the `Stop N at X%` labels. The selected stop's color input is labeled `Stop N`, its opacity `Stop N opacity`, and its position `Stop N position`; each handle is the slider `Gradient stop N`. The blend-space switch now sits under the stop row.

Additive: `selectedStop` and `onSelectedStopChange` let a caller own the selection, as an index into `value.stops`, and `disabled` draws the editor dimmed and inert.
