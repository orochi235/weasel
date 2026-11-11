---
'@weasel-js/routing': patch
---

The route-conflict check no longer reports bindings whose rules exclude each other but are written the long way. `rulesExclusive` simplifies both rules first, reading `{ not: { any: [ALWAYS] } }`, a one-member `all`, or `not` of `not` as the constant it is.

<!-- entry: fix -->
