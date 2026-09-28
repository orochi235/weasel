---
'@weasel-js/labkit': patch
---

`@weasel-js/labkit/weasel-ui` now passes through `sampleByInterpolation`, so a lab can sample the same curve a `CurveEditor` draws without importing a second copy of `@weasel-js/ui`.
