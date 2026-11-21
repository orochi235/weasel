---
'@weasel-js/quantity': patch
---

Parsing and `fieldLocale` cache at most 64 locales, so a page seeing many distinct locale tags no longer grows memory for each.

<!-- entry: fix perf -->
