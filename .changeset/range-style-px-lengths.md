---
'@weasel-js/text': patch
---

`styleAtRange` reads two runs whose `fontSize` or `letterSpacing` is the same `{ px }` length as sharing it rather than as `MIXED`, and `applyStyleToRange` merges such neighbors. Equal `{ px }` objects were compared by identity, so runs parsed from a saved document never matched.
