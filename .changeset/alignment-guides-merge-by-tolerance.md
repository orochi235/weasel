---
"@weasel-js/guides": patch
---

Edges and centers within 0.001 of each other always share one alignment guide. `deriveAlignmentGuides` merges them by tolerance, so boxes whose left edges sit at 10.0004 and 10.0006 share a guide spanning both.

<!-- entry: fix visual -->
