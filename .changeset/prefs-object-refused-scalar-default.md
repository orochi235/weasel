---
'@weasel-js/prefs-schema': patch
---

An `object` leaf whose `fromScalar` throws on a stored scalar reads and edits from its `default`, as repair already does, instead of throwing out of a condition or a field edit.

<!-- entry: fix -->
