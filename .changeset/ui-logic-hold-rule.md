---
'@weasel-js/ui-logic': minor
---

New `nestHold` and `controlAccess`: the rule disabled and read-only scopes follow, with no React, for any host.

`nestHold(outer, on, reason)` is the hold one level adds inside another: a level that is on holds everything inside it, an inner `false` adds nothing, and the nearest reason wins. `controlAccess(disabled, readOnly)` says how a control responds: disabled beats read-only, and a disabled control with no reason is the only one that leaves the tab order.

<!-- entry: api -->
