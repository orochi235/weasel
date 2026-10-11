---
'@weasel-js/ui': patch
---

In a `PrefsForm` rail pane with `rowsAcross={2}`, a checkbox stays on its label's line. A row's control asked for 80px beside the label whatever it was, so a checkbox with a longer label dropped to a second line with room to spare.
