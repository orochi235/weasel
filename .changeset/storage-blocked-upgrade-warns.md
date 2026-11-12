---
'@weasel-js/storage': patch
---

An IndexedDB adapter whose store needs an upgrade another tab is holding up warns that it is waiting for that tab to close, instead of leaving every read and write pending without a word.

<!-- entry: fix -->
