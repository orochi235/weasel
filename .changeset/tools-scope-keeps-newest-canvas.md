---
'@weasel-js/routing': patch
---

`useScopedTools` stays with the canvas that mounted last under a shared scope when another canvas switches tools, rather than moving to that one.

<!-- entry: fix -->
