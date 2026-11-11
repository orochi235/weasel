---
"@weasel-js/routing": patch
---

A keymap stack's `open()` now shows `usedWhileHeld: true` as soon as input arrives while a level's leader is held, and notifies subscribers when it does. The flag was set internally but the levels `open()` returned kept the old `false` until some other change refreshed them.
