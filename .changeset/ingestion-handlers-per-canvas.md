---
'@weasel-js/core': patch
---

Content handlers passed in `<SceneCanvas ingestion={{ handlers }}>` now run only on that canvas. They used to go into the page-wide registry and run on every mounted canvas. A handler meant for every canvas goes through `registerContentHandler`, which is unchanged. This changes behavior for an app that relied on one canvas's handlers reaching another.

The kit's handlers (`kit:image`, `kit:svg`, `kit:weasel-json`, `kit:text`) also belong to each canvas now, and a canvas can turn them off with the new `ingestion.kitHandlers`: `false` drops all of them, and `{ omit: ['kit:text'] }` drops the ones named. The default keeps all. Adds API: the `kitHandlers` option and its `KitHandlersOption` type.
