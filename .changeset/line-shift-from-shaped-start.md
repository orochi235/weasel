---
'@weasel-js/core': patch
---

Holding Shift on the line tool measured its 15° steps from the raw press point while the line was drawn from the start an insert behavior had moved (onto a guide, say), so a short line came out visibly off-angle. `insertAction` now constrains around the start the line is drawn from.
