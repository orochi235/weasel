---
"@weasel-js/core": patch
---

A `<SceneCanvas>`'s devtools root no longer announces a `registry` change on every selection
change. The dep registry also notifies when a source's value changes, which the selection does on
every change, so the root now announces only when the deps it lists come or go.
