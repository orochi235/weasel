---
'@weasel-js/ui': patch
---

`AssetEditor`'s Actions list draws an action's shortcut as keycaps, a key to a cap, where it wrote the shortcut out as text.

Adds `keySpecsFromLegend(legend)`: a shortcut already written out, as `formatShortcut` writes one (`⇧⌘Z`, `Ctrl+Shift+Z`, `Space`), as `KeySequence` keys.
