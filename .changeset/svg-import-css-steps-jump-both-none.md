---
'@weasel-js/svg': minor
---

`parseSvg` carries a CSS animation's `steps(n, jump-both)` and `steps(n, jump-none)` into the clip, and runs them backward on an alternate pass, where it used to read them as `steps(n, end)`.

<!-- entry: new data -->
