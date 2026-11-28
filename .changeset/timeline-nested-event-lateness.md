---
'@weasel-js/animator': patch
---

An event in a nested timeline reports `lateBy` as the root ms between where the frame crossed it and the frame itself, including at a nested timeline's end and under a nested `rate` or `loop`.

<!-- entry: fix -->
