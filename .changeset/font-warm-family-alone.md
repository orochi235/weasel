---
"@weasel-js/font": patch
---

`warmFonts` waits only on the families it names, so warming `a` no longer waits on, or fails with, a family named `a|400`.

<!-- entry: fix -->
