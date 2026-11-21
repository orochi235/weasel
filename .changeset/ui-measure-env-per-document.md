---
'@weasel-js/ui': patch
---

`createDomMeasureEnv` measures text with the fonts of the element's own document, so a label in an iframe or a popout window is sized in the face it draws in.

<!-- entry: fix visual -->
