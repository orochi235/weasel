---
'@weasel-js/routing': patch
---

`useTools` checks that its `active` tool is in the registry when it mounts only, so a host may later pass a registry without that tool.

<!-- entry: fix -->
