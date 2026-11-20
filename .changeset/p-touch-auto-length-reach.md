---
'@weasel-js/p-touch': patch
---

Under `autoLength`, a shape or text box reaching past either end of the label is drawn into the `.lbx` as an image cropped to the label, as everything else rasterized there is, so it no longer stretches the printed label.

<!-- entry: fix data -->
