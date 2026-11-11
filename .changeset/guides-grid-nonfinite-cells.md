---
"@weasel-js/guides": patch
---

`cellOf` and `pointToGridCell` put a value that is not finite in no cell; they answered a cell numbered `NaN`, or cell 0 on an axis with no lines. `linesNear` answers no line for such a value, nor where a pitch is too fine to count its lines out to it, where it answered lines at `NaN` or `±Infinity`.
