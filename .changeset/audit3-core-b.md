---
'@weasel-js/core': patch
---

Fix four bugs in core's domains and helpers:

- The picked measurement's end handles follow the end while it is dragged, rather than staying where the end was.
- A selection outline on a flipped view (a y-up camera) is padded outward, not inset.
- `createTextLayer` resolves a `{ px }` font size by the view scale's magnitude, so a flipped view no longer draws it at the wrong size or with a negative one.
- `solid` and `paintWithColor` move a `#rgba` color's alpha to `opacity`, as they already did for `#rrggbbaa`.
