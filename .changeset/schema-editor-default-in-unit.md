---
'@weasel-js/ui': patch
---

Fixes: `PrefSchemaEditor` edited a number's `default`, its `autoValue`, and what a new list or map entry starts as in the stored unit. A number with a `unit` now shows and takes all three in that unit, with its suffix, and stores them converted, as the leaf's own control does.
