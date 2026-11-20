---
'@weasel-js/pdf': patch
---

`writePdf` drops and reports only the text of a text layer that holds a non-finite coordinate, and still writes the layer's other texts.

<!-- entry: fix -->
