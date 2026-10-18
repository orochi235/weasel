---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` draws the fields of a list's or a map's object entry as rows under the list in its structure tree. A field picked there edits like any other pref, and its own Shown if and Enabled if offer the entry's other fields first, writing a test that reads from the entry (`{ from: 'item' }`). Renaming or moving a field carries those tests with it, and a condition wrong on a field is marked on the field's row rather than the list's. The export and the draft hold the entry as before.
