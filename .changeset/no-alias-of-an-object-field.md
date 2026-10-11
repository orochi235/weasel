---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` no longer makes an alias of a field inside an `object` pref: Add alias is off for one, and neither the tree's alias drag nor the preview's lands one. Such an alias named a path no reader resolves. A heading inside an `object` pref is also no longer counted as a step of its fields' value paths.
