---
'@weasel-js/headless': patch
'@weasel-js/quantity': patch
---

A tree's Left and Right mirror in a right-to-left list: `TreeShape` takes `dir`, and `rowKey` passes a list's own `dir` to it, so Left opens a branch and Right closes it under `'rtl'`. `COARSE_STEPS` now lives in `@weasel-js/quantity`, which `spinKey`'s Page Up and Page Down read, and `@weasel-js/headless` re-exports it as before.
