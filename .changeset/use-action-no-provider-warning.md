---
'@weasel-js/core': patch
---

Warn in dev when `useAction` finds no `ActionsProvider`

`useAction` returned early on a null registry, so an action registered above
the provider — or with no provider mounted — silently never fired its
bindings. It now warns in dev, naming the action id. Runtime behavior in
production builds is unchanged.
