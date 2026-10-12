---
'@weasel-js/prefs': patch
---

A bare test, `{ path: 'stops' }`, now means the value is set, and an empty list, a map with no keys, and an object holding no fields are not set. It held for all three before, since each is truthy. Every other value reads as it did: a boolean that is on, a number other than 0, a string that is not empty, and a paint that is not `null` are set. `PrefTest`'s docstring says what set means for each kind.
