---
'@weasel-js/ui': patch
---

`BandEditor` names each band with its range: a band's `aria-label` is `Band 2, 20 to 60`, and `Band 2, 20 to 60, locked` when locked, where it was `Band 2`. Each end is spoken through its own display when its `from` is tagged, else through `display`, so a band between two fraction seams reads `1 over 64 to 1 over 12`.

Breaking for a test that finds a band by the exact name `Band 2`.
