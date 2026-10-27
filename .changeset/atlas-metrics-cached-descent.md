---
'@weasel-js/font': patch
---

An atlas or canvas face's `GlyphMetrics.ascent` and `descent` no longer allocate on each read: the products are kept until the face's metrics are measured again. Values are unchanged.
