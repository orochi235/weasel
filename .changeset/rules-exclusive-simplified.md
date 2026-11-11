---
'@weasel-js/routing': patch
---

`rulesExclusive` simplifies both rules before proving them apart, so a rule written as a constant the long way (`{ not: { any: [ALWAYS] } }`, a one-member `all`, `not` of `not`) is read as that constant. The route-conflict check no longer reports bindings whose rules can never hold together only because one was written that way.
