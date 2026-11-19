---
'@weasel-js/audio': patch
---

A graph source whose `start` throws no longer keeps the sources after it from starting. `start()` starts the rest, leaves that one stopped so a later start retries it, and rethrows; `apply` goes on past it, as past a throwing `set`.

<!-- entry: fix -->
