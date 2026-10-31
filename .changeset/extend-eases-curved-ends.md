---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

Extend to next path now eases a curved end out of its bend instead of running it straight on: the
extension starts with the end's curvature, lets it fall linearly to zero (an Euler spiral) over the stretch
that turns it a further `easeTurn` (30° by default), then runs straight, so tangent and curvature both stay
continuous where it joins. `extendToMeet` searches along that curve for the first stroke it meets.

geom: a new `'eased'` `LengthenMode` for `lengthenPathEnd` and `lengthToward`, `extensionPieces` and
`easeLength` for the curve an end grows along, and `mode` and `easeTurn` options on `extendToMeet`
(default `'eased'`) and `lengthenOpenEnd` (default `'tangent'`). `extendToMeet`'s `distance` is now arc
length along the curve.

path-tools: the `extendToMeet` action declares `params` (`shape`: Eased or Straight, `easeTurn`), so its
settings appear in the last-operation panel after a click or the command; `lengthenPath` accepts
`mode: 'eased'`.
