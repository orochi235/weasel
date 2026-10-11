---
"@weasel-js/ui": patch
---

`PrefSchemaEditor` has settings of its own. A Preferences button at the end of its bar opens them, and the first is "Select what is dropped": on, as before, a node dropped into the live preview becomes the selection; off, the selection stays where it was, including through a drag begun on a row of the preview, whose press had selected that row.

The settings are a prefs schema, exported as `PREF_SCHEMA_EDITOR_PREFS`. A host keeps them by opening a prefs store over it and passing the store as the new `prefs` prop; with none, they last as long as the editor is mounted.
