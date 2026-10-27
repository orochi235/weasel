---
'@weasel-js/labkit': patch
---

`<CanvasStack>` under a scaled ancestor sizes its canvas at its layout size from the first pass, rather than at the scaled client size for one pass until its size observer reports.
