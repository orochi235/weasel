---
"@weasel-js/minimap": patch
---

A minimap fitting content too thin for any finite scale, such as a line 5e-324 long, now fits it at the
largest scale rather than the smallest. The fit's scale overflowed to `Infinity`, which the view's zoom
rule turns into its floor of 1e-9, so a thinner line was shown smaller than a thicker one.
