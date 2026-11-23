---
'@weasel-js/prefs-schema': minor
---

A group whose `enableIf` reads a field of an object leaf in it (`feature.opts.on`) keeps that field, and the object holding it, live while the rest of the group is disabled, so the switch can turn the group back on.

`PrefOwner` takes an optional `switchOf`, the owner whose condition spared the leaf only on the way to a field inside it; `prefStatusIn` keeps everything else under that leaf disabled.

<!-- entry: fix api -->
