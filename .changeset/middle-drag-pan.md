---
'@weasel-js/gestures': minor
'@weasel-js/routing': minor
'@weasel-js/core': minor
'@weasel-js/forge': patch
---

A middle-button drag pans the view under every tool on a canvas with the `view` preset. A `drag` binding names its button — `DragSpec.button`, written `drag(middle)` or `drag(secondary)` in a route, `primary` by default and `*` for any — and `middleDragPanContribution` adds the pan to a canvas without the preset. A press with another button only drags; one that no binding would drag is left to the browser. On a canvas that binds a secondary drag, a right-click opens its context menu on the release rather than the press.

<!-- entry: api new behavior rank=10 -->
