---
'@weasel-js/forge': patch
---

forge's story index reads no title, name, or meta from a top-level `let` or `var` that the story file reassigns, rather than its first value.

<!-- entry: fix -->
