---
'@weasel-js/storage': patch
---

The IndexedDB adapter's `list` finds every key under its prefix. It used to miss a key whose text after the prefix began with `￿` and went on past it.
