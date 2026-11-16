---
'@weasel-js/ui': patch
---

`KeyDiagram` stays up for the whole of a `linger` longer than 2³¹ − 1 ms, instead of dropping the moment the last key lifts.

<!-- entry: fix -->
