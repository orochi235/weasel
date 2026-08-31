---
'@weasel-js/core': patch
---

`@weasel-js/core/routing` exports the route-string projection

Anything rendering a `GestureSpec` as a route string had to re-implement the
projection, and the copy in WeaselDraw's registry inspector had drifted three
ways: it answered `drop` and `paste` with no gesture name, so every binding of
either vanished from the route list; its argument lookup missed a spec field;
and it gated targets on a hand-listed set of kinds, dropping them for
`pointerDown`, `longPress` and `wheel`.

New from the routing subpath: `routesForSpec(spec)` — every route string one
spec declares — plus `routeGestureForSpecKind(kind)` over the single spec-kind
map, and `PREDICATE_TARGET`, which `registry.ts` already exported but the
subpath index did not, so consumers reading `RegistryEntry.target` had no way
to compare against the sentinel its own docs name.
