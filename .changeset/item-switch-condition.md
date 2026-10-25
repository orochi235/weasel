---
'@weasel-js/prefs': patch
---

A list's or a map's item whose `enableIf` reads the entry (`{ from: 'item', path: 'on' }`) no longer disables the field it reads. `applyPrefEntryConditions` used to compare the condition's item-relative path with the field's full path (`phases.2.on`), so the switch that turns an entry back on was disabled with the rest of it. `PrefOwner` gains an optional `entry`, the entry's path, which `prefScopeIn` reads such a condition's paths under.
