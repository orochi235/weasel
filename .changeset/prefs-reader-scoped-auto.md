---
'@weasel-js/prefs-schema': patch
---

`prefReader` reads a split leaf as its selected option's value, and a leaf that starts auto as its `auto.value`.

With nothing stored, a split leaf reads its `defaultScope`, and an auto one never its `default`, so a `showIf` or an `enableIf` judged through it answers as the form shows the leaf.

<!-- entry: fix -->
