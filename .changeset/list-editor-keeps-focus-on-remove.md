---
'@weasel-js/ui': patch
---

Removing an entry from a `ListEditor` could leave keyboard focus on nothing: when the list emptied, and in any list drawn through `renderEntry` (every number, object, and map list in `PrefsForm`). Focus now lands on the entry before the removed one, its remove button where the entry has no text field, or on the add button when no entry is left.
