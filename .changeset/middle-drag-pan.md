---
'@weasel-js/gestures': minor
'@weasel-js/routing': minor
'@weasel-js/core': minor
'@weasel-js/forge': patch
---

A middle-button drag pans the view under every tool on a canvas with the `view` preset. A `drag` binding names its button — `DragSpec.button`, written `drag(middle)` in a route, `primary` by default and `*` for either — and `middleDragPanContribution` adds the pan to a canvas without the preset. A middle press only ever drags; one that no binding would drag is left to the browser.

<!-- entry: api new behavior rank=10 -->
