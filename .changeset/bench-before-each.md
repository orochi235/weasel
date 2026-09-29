---
---

Repo-internal, no package changes. The `getMesh miss` and cold `renderOrder` microbenchmarks now do their setup in tinybench's untimed `beforeEach`, so the `layer reorder only` benchmark that existed to be subtracted out is gone.
