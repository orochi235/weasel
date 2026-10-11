---
'@weasel-js/ui': patch
---

`Timeline` treats a key and a segment as one selection. Selecting a key, pressing on empty lane, or pressing Escape closes the easing picker; selecting a segment gives up the selected key (`onSelect(null)`), so the key editor and the easing picker never show together.
