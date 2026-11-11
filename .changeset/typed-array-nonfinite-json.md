---
"@weasel-js/headless": patch
"@weasel-js/geom": patch
"@weasel-js/animator": patch
---

A typed array's `NaN`, `Infinity`, `-Infinity` and `-0` survive a JSON round trip through `tagTypedArrays`, which writes them by name. Files saved before still read as they did. An animation clip still refuses a typed array holding a non-finite number.

<!-- entry: fix data -->
