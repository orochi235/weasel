---
'@weasel-js/ui': patch
---

`Timeline` ignores Delete on a selected key that is not drawn or no longer exists. That is a key on a folded nested row, or one past the end of its track in new `tracks`.

<!-- entry: fix -->
