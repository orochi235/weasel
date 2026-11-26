---
'@weasel-js/ui': patch
---

The EasingPicker's "Convert to bezier" writes the control points blits stores for the curve, within 0.003 of it.

It is no longer offered for the in-out quad, quart, quint, expo, circ and back curves, which no single cubic draws that closely.

<!-- entry: behavior -->
