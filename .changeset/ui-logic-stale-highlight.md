---
"@weasel-js/ui-logic": patch
---

The arrows, Home, End and typeahead treat a highlight that names no item, such as one left past the end of a shrunken list, as no highlight.

`stepStop` and `typeaheadMatch` no longer hand `canStop` or `label` an `undefined` item.

<!-- entry: fix -->
