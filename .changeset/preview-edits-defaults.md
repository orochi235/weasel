---
'@weasel-js/ui': patch
---

A value set in `PrefSchemaEditor`'s live preview becomes that leaf's `default` in the schema, in both the preferences-form preview and the properties-panel one. It shows in the Changes list and the exported literal, and undoes with the editor's other edits. The preview keeps no values of its own, so its "Reset values" button is gone.
