---
'@weasel-js/ui': patch
'@weasel-js/core': patch
---

`absentIsDefault` now also works on a field of an object leaf in `SelectionPanel`: a field the held object omits draws the field's default and is not Mixed beside an object holding that default, while a field of an object the node does not hold stays unset. `defaultNodeProperties` and `inferredNodeProperties` set the flag on every leaf the engine reads with a fallback: a stroke's width, cap, join, and align; a text node's text, style, and vertical alignment; and the style's family, size, weight, rules, tracking, case, small caps, leading, wrap, and align. So a text node with an empty style shows 16 and sans-serif where it showed blanks.
