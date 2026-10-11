---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` keeps a condition reading the value it read. Renaming a key or moving a leaf or a group used to leave every `showIf` and `enableIf` that read it naming the old path; each one, on a leaf, a group, a section, or a list's entry, now follows the move, as an alias's `of` and a pair's `with` already did.
