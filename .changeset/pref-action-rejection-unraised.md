---
"@weasel-js/ui": patch
---

A pref `action` leaf whose `run` returns a promise that rejects no longer raises an unhandled rejection of its own, and a returned thenable without `finally` works.

<!-- entry: fix -->
