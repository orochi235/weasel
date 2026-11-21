---
'@weasel-js/text': patch
---

A run grammar with a backslash delimiter throws in `runsToMarkdown` and `markdownToRuns`. A backslash escapes the delimiters, so its markers could not be read back.

<!-- entry: fix behavior -->
