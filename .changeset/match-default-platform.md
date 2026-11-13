---
'@weasel-js/gestures': minor
---

`matchModifiers` and `matchSpec` default `isMac` to `isApplePlatform()`, as `specificity` does, so a caller matching on the running platform can leave it out.

<!-- entry: api -->
