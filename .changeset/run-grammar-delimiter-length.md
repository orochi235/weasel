---
'@weasel-js/text': patch
---

`runsToMarkdown` and `markdownToRuns` throw for a grammar delimiter longer than one UTF-16 unit, such as `'~~'`, which neither could read back.

Spell a doubled marker as one character with `repeat: 2`.

<!-- entry: fix behavior -->
