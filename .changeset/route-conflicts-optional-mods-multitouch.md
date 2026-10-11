---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
---

The route-conflict check compares two kinds of tie it used to miss. A binding with an optional modifier is now compared with one that forbids it, since both take the bare press at equal rank: `ArrowLeft` with `shift: 'optional'` against plain `ArrowLeft` is reported. And `multiTouch` is a route gesture, written `multiTouch(2)`, so two bindings on the same finger count are compared, `routesForSpec` prints one, and `routeToSpec` parses it.
