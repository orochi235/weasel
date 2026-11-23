---
'@weasel-js/gestures': patch
---

`routeToSpec` and `canonicalModifiers` treat a parsed route's modifier set to `undefined` as absent, as `formatRoute` does.

<!-- entry: fix -->
