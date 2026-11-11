---
"@weasel-js/routing": patch
---

`rulesExclusive` proves more rules exclusive that its own reasoning covers: a compound rule against its `not`, the never-rule (`any` of nothing) against any rule, and an `any` whose alternatives are each ruled out by a different part of an `all`. The route-conflict check uses it, so bindings gated by such rules are no longer reported as conflicting.
