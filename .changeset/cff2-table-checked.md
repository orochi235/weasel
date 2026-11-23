---
'@weasel-js/font': patch
---

The outline parser checks a CFF2 face's table before reading it, as it already checked CFF 1, and refuses a damaged one with an error rather than hanging on it.

<!-- entry: fix -->
