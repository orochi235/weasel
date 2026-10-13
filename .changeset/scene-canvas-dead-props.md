---
'@weasel-js/core': patch
---

Breaking: `<SceneCanvas>` no longer takes `insertTool`. It set `commitInsert` on the adapter, which nothing in the kit calls: the insert action mints nodes through the `insert` dep, so override that dep (`useDepSource('insert', …)` or `insertNodeFactories`) instead.
