---
'@weasel-js/ui': patch
---

`UnitField` takes back on Escape what it sent through `onInput` while typing. Every readable keystroke reached `onInput`, and Escape then only cleared the text, so a caller holding the live value kept the abandoned one: a property row wired with a single callback showed `25` after typing `25` over `10` and pressing Escape. Escape now sends the value typing began from through `onInput`.
