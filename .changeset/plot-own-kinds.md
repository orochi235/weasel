---
'@weasel-js/plot': patch
---

`compilePlot`, `plotSchemaOf` and `plotEditorOf` treat a chart whose `kind` is `constructor` or `toString` as a kind they do not know.

<!-- entry: fix -->
