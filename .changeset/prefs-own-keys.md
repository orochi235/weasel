---
'@weasel-js/prefs': patch
---

Pref paths, schema keys and selector options named like `constructor` or `__proto__` read and write as data, not as `Object.prototype` members.

`createRecordSource` reads such a path as holding nothing, the schema editor's `setAttribute` throws for a missing node at such a key instead of editing `Object`, and `createWeightAxes(…).from` keeps a `__proto__` selector as an entry rather than writing onto `Object.prototype`.

<!-- entry: fix -->
