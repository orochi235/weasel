---
"@weasel-js/pdf": patch
---

A stroke with a miter limit below 1 is written with a limit of 1, which PDF accepts and which bevels every corner as
the renderer does, instead of a limit PDF readers refuse.
