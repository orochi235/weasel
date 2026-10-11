---
'@weasel-js/select': patch
---

`select()` documents that it returns the selection it was given when a press changes nothing, so a caller can compare by reference, but it did so only for an empty range. Pressing the one selected id, or ranging to the end already selected, returned a new equal object. It now returns the same one.
