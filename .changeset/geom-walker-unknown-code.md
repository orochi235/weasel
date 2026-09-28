---
"@weasel-js/geom": patch
---

`forEachSegment` throws on a command code `PATH_COMMANDS` does not declare, instead of carrying on with the coord stream misaligned from that command onward. The visitor still sees the code first, so a caller's own error message wins.
