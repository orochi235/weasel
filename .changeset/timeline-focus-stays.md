---
'@weasel-js/ui': patch
---

`Timeline` leaves focus where it is after a key press that changes nothing. An arrow key that cannot move a key, or a refused Delete, no longer pulls focus to the selected key on the next render.

<!-- entry: fix -->
