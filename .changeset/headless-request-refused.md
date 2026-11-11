---
"@weasel-js/headless": patch
---

A malformed headless render request rejects before any browser starts, with an error naming the field. That means a missing or non-object scene, a `sourceRect`, `scale` or `screen` entry that is not a finite number, or an unknown `format`; the page refuses one the same way.

<!-- entry: fix -->
