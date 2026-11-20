---
'@weasel-js/p-touch': patch
---

A text box with its own `lineHeight` or `tabSize` is drawn into the `.lbx` as an image when it would use them.

That is a box of more than one line for `lineHeight`, and one holding a tab for `tabSize`, so its lines and tab stops sit where the canvas puts them.

<!-- entry: fix data -->
