---
'@weasel-js/prefs-schema': patch
---

Pref selectors, object fields and validator kinds named like `constructor` or `toString` read as absent, not as `Object.prototype` members.

`weighScope`, `prefScopeValue` and `writeDeclared` treat such a selector as one the weights or selection leave out, `prefObjectField` returns `undefined` for such a field, and `repairPrefValue` runs no validator for such a kind.

<!-- entry: fix -->
