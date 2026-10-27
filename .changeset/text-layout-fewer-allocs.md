---
'@weasel-js/text': patch
---

Laying out, painting and resolving text allocates less per call: line breaking reuses its lines, sums and entry lists from one layout to the next instead of copying the entry that opens each line, painting reuses its group slots, and resolving a style or a run no longer builds an empty object for each optional field it leaves out. No result changes.
