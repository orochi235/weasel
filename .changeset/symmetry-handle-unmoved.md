---
"@weasel-js/symmetry": patch
---

A guide handle dragged back to where it was pressed leaves the group as it was, and records no undo step. Before, the axis, step, or row took the pressed point's direction and distance, so a knob pressed off its line, a step handle of a negative spacing, or rounding alone changed the spec.
