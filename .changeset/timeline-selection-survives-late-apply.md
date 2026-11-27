---
"@weasel-js/ui": patch
---

A `Timeline` keeps its key or segment selection when the consumer applies an edit late. That covers a store written after an `await`, or an edit never applied.

<!-- entry: fix -->
