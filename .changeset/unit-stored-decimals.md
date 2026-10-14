---
'@weasel-js/prefs': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

A linear unit stores a decimal typed at a decimal `scale` as the decimal the two multiply to: 33.3 at a scale of 0.01 is 0.333, where it was 0.33299999999999996. Nothing is rounded away, and a scale that is no short decimal (degrees over radians) converts as before.

The text tool's percent unit for `fontScale` and `baselineShift` is that data now (`{ scale: 0.01, precision: 1, suffix: '%' }`) and no longer a pair of functions, so the run properties print as a literal. Breaking in one detail: a percentage typed to more than three places is stored as typed, where it was cut to five places of the stored fraction.

labkit's one-line summary of a compound leaf writes each number that has a unit as its field shows it, in an object's fields, a list's and a map's entries, and a union's variant, and writes a list of objects entry by entry where it wrote `[object Object]`. Additive: `summarizeLeaf(leaf, value)` is exported beside `summarizeValue`, and `inDialog`'s default summary is the leaf's.
