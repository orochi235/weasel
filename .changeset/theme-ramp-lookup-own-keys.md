---
'@weasel-js/theme': patch
---

`rampSteps`, `findRampSteps` and the color lists and refs built on them find a ramp by the theme's own ramp names only.

A missing ramp named like an `Object.prototype` member, such as `constructor`, throws that the theme has no such ramp, as any missing ramp does.

<!-- entry: rank=-5 fix -->
