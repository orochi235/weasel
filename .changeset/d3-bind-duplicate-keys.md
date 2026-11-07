---
'@weasel-js/d3': patch
---

`d3Bind(...).join()` throws, before touching the scene, when two data share a key, naming the key and both indices. Two such data used to fail with the scene's `id collision` when they entered, and when they updated a node already there, the later one silently won and the selection held its id twice.
