---
'@weasel-js/gestures': patch
---

`routeToSpec` and `canonicalModifiers` treat a modifier set to `undefined` in a parsed route as absent, as `formatRoute` and `describeRoute` already do.

<!-- entry: fix -->
