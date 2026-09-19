---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

A config node's `validate` now receives the instrument's whole config as its
second argument, so its errors can depend on the value being validated. This is
additive: a validator that takes only the leaf keeps working.

forge keeps each config's validation errors apart. Two trials of one story used
to share a single errors map, replaced by whichever frame answered last; each
trial now reads the errors its own config produced.
