---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A row can now hold an editor too big for it. weasel-ui's `DialogRow` shows a one-line summary of the value on a button, and the button opens a modal around whatever body it is given; `ListEditor` edits a list of strings one field per entry. In labkit, `.dialog(body)` on any config leaf moves that leaf's control into such a dialog, and `inDialog(body)` builds the same row as a renderer for a panel's `renderers`. The new `f.list([...])` leaf is a list of strings drawn this way by default, and an `f.value` whose default is an array of strings now resolves to it.
