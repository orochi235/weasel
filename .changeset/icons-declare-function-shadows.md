---
'@weasel-js/icons-plugin': patch
---

A `declare function icon` inside a namespace shadows the imported `icon`, so the plugin leaves that namespace's calls as written.

<!-- entry: fix -->
