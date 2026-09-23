---
'@weasel-js/ui': patch
---

WeaselDraw's preferences dialog moves to the rail layout, with the filter field
on. Its five groups used to wrap into columns the dialog was too narrow to
hold.

`Dialog`'s `min-height: 0` moves into the same `:where()` block as its padding
and overflow. Left in a plain rule it beat `bodyClassName` on source order, so
a body asked to hold a height did not, and the dialog resized itself around
whichever pane was open.
