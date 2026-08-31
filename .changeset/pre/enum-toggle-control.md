---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

An enum leaf can ask for a segmented control, and `pair` works inside an object

`ToolPrefEnumControl` gains `'toggle'`: a three-option enum shows all three at
once instead of hiding two behind a select. Options carry an optional `short`
label — a capital or two — for the width a property row has; the full `label`
stays the accessible name, so the abbreviation never becomes the only thing
naming the option. A mixed selection selects no segment rather than picking a
winner.

`pair` now merges fields inside an object leaf, as it already did for section
rows — a hint shouldn't mean something different for being a field of a value
rather than a sibling of one. It merges *adjacent* leaves in both places, so
the schema orders family, size, weight: size and weight pair, and family (which
sat between them) moves ahead of the pair rather than splitting it.

A stroke's cap, join and align share one row; property rows wrap rather than
overflow when the controls in them don't fit.
