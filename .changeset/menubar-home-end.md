---
'@weasel-js/ui': patch
---

`MenuBar` moves focus to its first and last title on Home and End, as every other roving row in the kit does. Its titles now step through `rovingTarget`, the same rule `useRovingTabIndex` follows.
