---
"@weasel-js/prefs": patch
---

Add `mergePrefGroups(name, ...groups)`: one group holding every child of the groups given, merging
groups that share a key and throwing where a leaf meets anything at the same path. It composes
schemas that add to the same areas, such as the kit settings groups `ui` and `core` both export.
