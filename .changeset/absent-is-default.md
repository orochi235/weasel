---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/core': patch
---

A leaf may say `absentIsDefault: true`: nothing held where its value is read means its `default`. `SelectionPanel` draws that default for a node with no value at the leaf's path, and no longer reads such a node beside one holding the default as Mixed; nothing is written until an edit, which writes only the value typed. `defaultNodeProperties` sets it on `pose.rotation`, so a node whose pose has no `rotation` shows 0. `aggregateValue` takes the value an empty path reads as, and `PrefSchemaEditor` offers the flag among a leaf's attributes.
