---
'@weasel-js/routing': patch
---

A drop whose files fail to read, or whose action throws while it runs, is logged as a `weasel dispatcher` error instead of surfacing as an unhandled promise rejection.

<!-- entry: fix -->
