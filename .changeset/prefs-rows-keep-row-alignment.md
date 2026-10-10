---
'@weasel-js/ui': patch
---

`PrefsForm`'s rail layout no longer centers a row's label against its control. The row's own
alignment stands, as it does everywhere else a `PropertyRow` is drawn: a row past one line, such
as a radio group, sets its label on the control's first line.
