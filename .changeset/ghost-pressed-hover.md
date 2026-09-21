---
'@weasel-js/ui': patch
---

A pressed `ghost` `Button` keeps its pressed background under the pointer. The ghost hover rule outranked `.pressed`, so a toggle clicked on showed no change until the pointer left it.
