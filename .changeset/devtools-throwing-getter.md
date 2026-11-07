---
'@weasel-js/core': patch
'@weasel-js/devtools': patch
---

The devtools hook writes a getter that throws, on a node's `data` or anything else it serializes, as `[threw: <error>]` and serializes the rest of the object. One such getter used to make the whole request fail, so the panel showed nothing for that node.
