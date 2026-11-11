---
"@weasel-js/guides": patch
---

`cellOf`, `pointToGridCell`, and `linesNear` put a value that is not finite in no cell and near no line.

`linesNear` also answers no line where a pitch is too fine to count its lines out to the value.

<!-- entry: rank=-5 fix -->
