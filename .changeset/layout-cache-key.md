---
'@weasel-js/text': patch
---

`cachedLayoutRuns` could hand back a layout made for different options: its key left out `direction`, the `bidi` engine, and a run's `strutSize`. A call differing only in `direction` or in whether an engine was passed got the earlier call's lines, and a shrunken run (`fontScale`) could share a line height with plain text of the same size. All three are now part of the key.
