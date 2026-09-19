---
'@weasel-js/core': patch
---

New `effectiveRangeStyle(range, style, paint?)` reports what is actually rendering across a text range: the range's styling (from `styleAtRange` or `useTextEdit`'s `rangeStyle`) resolved against the node's own `TextStyle` and paint, the way the canvas resolves runs. A node-level flag reads as on across the whole range, a run's override wins over the node's value, and with a `null` range it reports the node alone. Additive: `styleAtRange` and `rangeStyle` still report the runs alone, unchanged.
