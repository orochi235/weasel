---
"@weasel-js/ui-logic": patch
---

The arrows, Home and End, and typeahead read a highlight that names no item, such as one left past the end of a list that shrank, or `0.5`, as no highlight, as `tabStep` already reads a target gone from the tab order. `stepStop` and `typeaheadMatch` used to hand `canStop` and `label` an `undefined` item for it, which a shape reading the item's fields threw on, and stepping back from past the end could skip the last item.
