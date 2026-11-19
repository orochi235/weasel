---
'@weasel-js/svg': patch
---

The SVG importer reads a very long length attribute, such as a page of digits or of spaces, in time linear in its length.

<!-- entry: fix perf -->
