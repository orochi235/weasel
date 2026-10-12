---
'@weasel-js/ui': patch
---

Fixes: an `ItemList` row removed while focus was inside it, as a remove button in its `trailing` cell does, dropped focus to the page. Focus now moves to the row that took its place, else the row above. Focus that something else took in the same render stays where it was put.
