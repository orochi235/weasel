---
'@weasel-js/pdf': patch
---

`writePdf` lists a face that failed to embed in `skipped` even when the command that first used it is dropped.

A `strict` export now refuses such a document, as it does any other failed face.

<!-- entry: fix -->
