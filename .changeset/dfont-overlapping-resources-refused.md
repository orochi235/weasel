---
'@weasel-js/font': patch
---

The outline parser refuses a `.dfont` whose map names one `sfnt` resource more than once, or two that overlap, rather than copying it once for each reference.

<!-- entry: fix -->
