---
'@weasel-js/ui': patch
---

Adds API: `overflow` on `Bar` and `BarLayout`. `overflow="menu"` keeps the cells the bar's line has room for, in order from the first, and opens the rest from a button at the end of the line, one under another in the forms they have on it; `overflowLabel` names that button and its popover, `More` by default. The bar measures before its first paint and again when it or a cell changes size, and it never leaves a divider at the end of the line or the head of the menu. A bar set to `'menu'` takes all the room its host has along the line. The default, `'scroll'`, is the behavior a bar had: every cell stays on the line. Exports `BarOverflowMode`.
