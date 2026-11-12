---
'@weasel-js/font': patch
---

DOM text set through `cssFontFamily` stops using a variant's file once `unregisterFontOutlines` drops that variant.

<!-- entry: fix -->
