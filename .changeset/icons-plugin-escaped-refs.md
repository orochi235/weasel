---
"@weasel-js/icons-plugin": patch
---

A library build re-annotates an icon ref that a chunk spells with escapes, as ASCII-only output does. An `icon()` name holding a lone surrogate is written escaped, so it reaches the output unchanged.

<!-- entry: fix -->
