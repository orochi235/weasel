---
'@weasel-js/ui': patch
---

`PrefsForm` with `rowsAcross={2}`: an object or list leaf, which spans both columns, sets its label in the first column and its control in the second, so its rows start where the second column's rows do and end where they end. Before, the label took about three fifths of the pane and the control was squeezed into the rest, under neither column and narrow enough to clip a number field's digits. The label sits on the line of the control's first row.
