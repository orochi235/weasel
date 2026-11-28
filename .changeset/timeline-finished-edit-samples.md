---
'@weasel-js/animator': patch
---

`edit` and `seek` on a finished timeline sample its tracks where the playhead stands, calling `onTick` and committing the value to each target.

<!-- entry: fix -->
