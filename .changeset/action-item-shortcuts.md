---
'@weasel-js/routing': minor
'@weasel-js/core': minor
---

New `actionItemShortcuts(item)`: an `ActionItem`'s declared `shortcut` text, else the bindings `actionShortcuts` finds for it.

It looks bindings up with the item's params.

The command palette, `Prefs` action rows, and the pref schema editor read their hints through it.

<!-- entry: api -->
