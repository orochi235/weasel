---
'@weasel-js/routing': patch
---

A tool option shared as an enum or a string keeps every value any tool naming it may write in a prefs store from `toolOptionsPrefs`.

The shared enum offers every tool's options and the shared string takes the longest `maxLength`. `toolOptionsPrefs` now throws when two tools declare one shared key as different kinds.

<!-- entry: fix behavior -->
