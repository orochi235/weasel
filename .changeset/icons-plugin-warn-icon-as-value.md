---
'@weasel-js/icons-plugin': patch
---

The icon plugin warns on an imported `icon` used other than as a direct call, as in `names.map(icon)`, whose glyphs a trimmed build can miss.

`icon!('x')` and `(icon)('x')` are rewritten as direct calls.

<!-- entry: fix -->
