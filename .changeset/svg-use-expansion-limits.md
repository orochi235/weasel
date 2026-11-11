---
"@weasel-js/svg": patch
---

`parseSvg` no longer hangs on `<use>` references that multiply, or throws on elements nested thousands deep.

It draws at most 100,000 elements through `<use>` references per document and walks elements at most 512 deep, warning once when either limit stops it.

<!-- entry: fix -->
