---
"@weasel-js/headless": patch
"@weasel-js/geom": patch
"@weasel-js/animator": patch
---

A headless render whose request is malformed (a missing or non-object scene, a `sourceRect`, `scale`, or `screen` entry that is not a finite number, an unknown `format`) now rejects before any browser starts, with an error naming the field, and the page refuses one the same way rather than failing on it partway. `tagTypedArrays` writes a typed array's `NaN`, `Infinity`, `-Infinity`, and `-0` by name, so they come back through JSON as themselves where they used to read back as `0`; files saved before still read as they did. An animation clip still refuses a typed array holding a non-finite number.
