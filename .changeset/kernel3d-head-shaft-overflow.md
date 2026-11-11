---
"@weasel-js/kernel3d": patch
---

`headFor`, and the line pass's shader with it, never give a shaft wider than it was asked for. Near the double range the shaft's width times the head's length overflowed to infinity, and the shaft came back as wide as the head's base instead.
