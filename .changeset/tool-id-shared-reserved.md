---
'@weasel-js/routing': patch
---

`defineTool` and `toolOptionsPrefs` throw for a tool with options whose id is `shared` or starts with `shared.`.

Its options would mix into the ones every tool shares.

<!-- entry: fix -->
