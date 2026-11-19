---
'@weasel-js/core': patch
---

`describePresets` marks a node-kind preset as an atom, so the prefs bundle editor no longer breaks one apart.

The roles it now counts are `routing`, `shapes`, `properties`, `insertNodeFactories`, `insertKinds` and `toolActions`.

<!-- entry: fix -->
