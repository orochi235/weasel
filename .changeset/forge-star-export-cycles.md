---
'@weasel-js/forge': patch
---

The workshop indexes a story file promptly when barrels re-export each other with `export *`, instead of stalling on the lookup.

<!-- entry: fix perf -->
