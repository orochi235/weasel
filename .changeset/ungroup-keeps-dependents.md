---
"@weasel-js/core": patch
---

Ungroup no longer deletes nodes that derive from the dissolved group: each drops the group from its `dependsOn` in the same undoable batch.

<!-- entry: fix -->
