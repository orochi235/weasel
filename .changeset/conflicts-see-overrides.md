---
"@weasel-js/routing": patch
"@weasel-js/core": patch
---

The dev-time route-conflict check and devtools' registry listing now read contribution bindings under
their binding overrides, as dispatch does: a binding rebound onto a taken key is reported, and an
unbound one is no longer listed or reported. The conflict check runs again when the overrides change.
`overriddenBindings` returns a binding list under the overrides in force, and `findScopedConflicts`
takes them as `overrides`.
