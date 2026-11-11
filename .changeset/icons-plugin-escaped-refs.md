---
"@weasel-js/icons-plugin": patch
---

A library build now finds and re-annotates an icon ref that a chunk spells with escapes (`"core:é"`, as ASCII-only output writes it), where it used to pass that chunk over and could ship the ref unannotated. An `icon()` name holding a lone surrogate is written escaped, so it no longer reaches the build's output as a different name.
