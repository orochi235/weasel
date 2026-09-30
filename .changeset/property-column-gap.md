---
'@weasel-js/ui': patch
---

The 2-up property layout (`pack="pairs"`) spaces its columns further apart: 16px at normal density, up from 10px, and 20px at roomy, up from 14px, so roomy stays wider than normal. Tight stays 8px. A list with no density set falls back to 16px, matching normal.
