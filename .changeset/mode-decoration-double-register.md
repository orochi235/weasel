---
'@weasel-js/modes': patch
---

`createModeDecorations`: releasing an older registration of a painter no longer removes the live one when the same function was registered again for that mode, as a remounting effect does.
