---
'@weasel-js/ui': patch
---

`PrefConditionEditor` takes `exclude`, value paths its pref pickers leave out: the pref at each, and every pref beneath it. A row that already reads one keeps it. `PrefSchemaEditor` passes what the selected nodes hold themselves, so a pref can no longer be shown or enabled by its own value, nor a group or a section by a pref inside it.
