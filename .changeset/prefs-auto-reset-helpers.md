---
'@weasel-js/prefs': minor
---

New helpers say whether a leaf can be auto, what it reads while auto, and what a reset makes of it.

They are `prefCanAuto`, `prefStartsAuto`, `prefAutoValue`, `prefResetOf`, `prefIsReset`, `prefResets` and `prefStoredReset`. `prefAutoValue(leaf, computed)` is what the owner computed, else the leaf's `auto.value`, and never its default. `PrefGroup` and `PrefSection` take `resettable`, which gives the group's heading a reset of everything under it.

<!-- entry: api new -->
