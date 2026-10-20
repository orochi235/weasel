---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

A `carry` spec takes a `target`, matched against what is under the carry the way a click's is: a binding can now say "dropped onto a selected body" or onto an affordance. An immediate action with a target fires only on a release over it; an ongoing one starts on the first step over its target, as the carry comes over or as it moves on. The route grammar reads `carry(lab/*) => selected-body`. A carry's immediate params carry `affordance`, `bodyTarget`, and `bodyKind`.

`Action.enabled`'s `carried` argument is now the exported `Carried` type and sees a carry too: `{ items: [], carry: { type, value } }`, so an action can refuse a payload it would not take.
