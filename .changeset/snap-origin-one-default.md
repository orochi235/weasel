---
"@weasel-js/core": patch
---

`guideSnapStrategy` and `snapBackOrDelete` now default to `AUTO_ORIGIN_PROJECTION`, like `gridSnapStrategy` and `snap`, so a `Path` pose snaps to guides and snaps back without passing `pathOriginProjection`. Rect poses behave as before.
