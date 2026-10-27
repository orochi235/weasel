---
'@weasel-js/ui': patch
---

A row's hint no longer runs into its control when it is wider than the label track: it moves to a line of its
own after the label, and wraps inside itself only where that line is still too narrow. In `PrefsForm`, the toggle
that opens a split row now sits after the row's control instead of on its label line, so a row that can be split
stays a `<label>`: an app renderer's control on such a leaf is named by the row again, as on any other leaf. The
mode marks stay on the label line, in the hint.
