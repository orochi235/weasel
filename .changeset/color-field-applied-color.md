---
'@weasel-js/ui': minor
---

`ColorField`'s `onChange` can return the color it actually applied, and the recent colors record that color in place of the pick.

Return nothing and the pick is recorded, as before. Return a string, or several for a commit that applied more than one.

<!-- entry: api -->
