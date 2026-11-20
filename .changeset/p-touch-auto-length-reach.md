---
'@weasel-js/p-touch': patch
---

Under `autoLength`, a shape or text box reaching past an end of the label is drawn into the `.lbx` as an image cropped to the label.

It no longer stretches the printed label past the length it was given, and is cut where rasterized paint beside it is.

<!-- entry: fix data -->
