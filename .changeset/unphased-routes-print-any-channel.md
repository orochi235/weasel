---
"@weasel-js/gestures": patch
"@weasel-js/routing": patch
---

A binding with no `phase` now prints as `[*:*]` rather than `[*]` in `routesForSpec`, conflict messages and the dispatch record. `[*]` is shorthand for `[&:*]`, which an ambient binding never matches and which ranks higher on phase, so a route copied out of the inspector used to describe a different binding from the one it was printed from. `routeToSpec` now reads `[*:*]` as "no phase" and keeps `[*]` as the `&:*` atom it abbreviates; a route string that relied on `[*]` meaning "no phase" should say `[*:*]`.
