---
'@weasel-js/prefs-schema': patch
---

`applyPrefConditions` drops a group or a section that holds no members at all, unless `keepEmpty` is set.

It already dropped one its conditions emptied, so a form no longer draws a bare heading for one that starts out empty.

<!-- entry: fix -->
