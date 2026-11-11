---
"@weasel-js/guides": patch
---

`deriveAlignmentGuides` derives no line from a box with a coordinate that is not finite. Such a box gave lines at `NaN` or `±Infinity`, and among siblings they scrambled the sorted lines `alignmentSnapSource` searches, so a move missed lines in reach.
