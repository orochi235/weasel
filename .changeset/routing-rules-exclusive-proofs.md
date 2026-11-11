---
"@weasel-js/routing": patch
---

The route-conflict check no longer reports bindings gated by more kinds of rules that can never hold together.

`rulesExclusive` now proves a compound rule exclusive of its `not`, the never-rule (`any` of nothing) exclusive of any rule, and an `any` exclusive of an `all` whose parts rule out each of its alternatives.

<!-- entry: fix -->
