---
'@weasel-js/prefs-schema': patch
---

Editing one field of an `object` leaf that holds nothing starts from the leaf's `default`, even when the leaf has `fromScalar`.

<!-- entry: fix -->
