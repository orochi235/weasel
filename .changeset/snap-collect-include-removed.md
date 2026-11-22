---
'@weasel-js/core': major
---

`SnapCollect.include` is removed: no snap session ever set it, and only the path snap source read it.

A host that sets `include` when building its own collect request should drop it and filter which nodes a source sees itself, for instance by adding the rest to `exclude`.

<!-- entry: breaking api -->
