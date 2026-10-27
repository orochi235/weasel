---
'@weasel-js/routing': patch
---

A `list` drawn as a menu removes any entry, not only the last: its `Remove <item>` row is now a submenu naming each entry (`Cap 1`, `Cap 2`). A `map` drawn as a menu gains an `Add <item>` text row, which adds an entry at the item's default under the key typed into it, and a `Remove <item>` submenu naming each key. A map key holding a `.` is no longer left out: its path segment escapes the `.` (and any `\`) with a `\`, so the row path of `{ 'a.b': 1 }` under `sizes` is `sizes.a\.b`. The list's remove row changes shape, from an item to a submenu.
