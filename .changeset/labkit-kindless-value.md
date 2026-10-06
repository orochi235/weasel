---
'@weasel-js/labkit': patch
---

An `f.value` leaf whose kind can't be inferred from its default — `f.value(null)`, an object — now fails when its schema resolves, with an error naming the leaf's path and the fix (a typed builder, or `f.custom(kind, default)`). It used to resolve to a leaf with no `kind`, which the auto-config walk then took for a group and crashed on with `Cannot convert undefined or null to object` the first time a trial was added. A lab rule that supplies the kind still makes such a leaf valid.
