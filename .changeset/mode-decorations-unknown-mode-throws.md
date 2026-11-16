---
'@weasel-js/modes': patch
---

`ModeDecorations.register` throws for a mode id its registry does not have, as `byId` does.

Calls that used to pass silently now throw: a painter registered under a misspelled mode id never painted.

<!-- entry: fix behavior -->
