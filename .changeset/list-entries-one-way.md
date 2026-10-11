---
'@weasel-js/ui': patch
---

A list leaf's entries read one way in `SelectionPanel` and `PrefsForm`: an entry holding nothing draws the item's default (`prefListEntry`), where the panel drew it unset. `SelectionPanel` also looks an entry's renderer up by its path (`data.tags.0`) before its kind, as it does for every other leaf.
