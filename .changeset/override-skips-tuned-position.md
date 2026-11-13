---
'@weasel-js/routing': patch
---

A binding override named by position (`<action>@<n>`) reaches only the action's own bindings, never a key a tuning added.

A key a tuning adds is overridden by its `opts.id`.

<!-- entry: fix -->
