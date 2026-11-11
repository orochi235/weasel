---
'@weasel-js/theme': patch
---

`rampSteps`, `findRampSteps`, and the color lists and refs built on them find a ramp by the theme's own ramp names only. A ramp named like an `Object.prototype` member (`constructor`, `toString`) used to answer with that member, so `colorCount({ ramp: 'constructor' })` was 1 and `colorCssAt` wrote `var(--wzl-constructor-undefined)` rather than throwing that the theme has no such ramp.
