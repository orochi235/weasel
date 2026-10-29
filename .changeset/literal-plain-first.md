---
'@weasel-js/ui': patch
---

The schema editor's Export panel draws its literal as plain text on the first frame and colors it once React has time, so opening an asset no longer waits on highlighting the whole literal; while the literal changes, the last colored version stays up until the new one is ready. `CodeBlock` takes `language="text"` for a block drawn without highlighting.
