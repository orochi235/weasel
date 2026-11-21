---
'@weasel-js/text': patch
---

The markdown label renderer keeps a delimiter nothing closes as text. `5 * 3 = 15` draws its asterisk and no longer italicizes everything after it, in `markdownToRuns` too.

<!-- entry: fix behavior -->
