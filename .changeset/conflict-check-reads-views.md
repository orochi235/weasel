---
"@weasel-js/routing": patch
---

The route-conflict check now reads a binding's `opts.views`. A view-scoped binding and an unscoped one on the same route never tie — outside its views the scoped one is not live, and inside them it outranks the unscoped one — so the check no longer warns about them; two bindings scoped to overlapping views still conflict. This silences the warning `createMinimapContribution`'s drag raised against `viewport.dragPan`. `RegistryEntry` gains an optional `views`.
