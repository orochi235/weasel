---
'@weasel-js/diagram-formats': patch
---

DOT: an id or page name ending in a backslash, or holding one before a quote, was written so the file no longer parsed; backslashes in quoted names are now written doubled and read back as one. A `width`, `height`, or `penwidth` that is not a number is dropped with a warning instead of reaching the diagram as `NaN`. Edge labels read `\E`, `\T`, and `\H` as the edge, its tail, and its head, and a strict graph's repeated edge statements set their attributes on the one edge it keeps instead of being thrown away.
