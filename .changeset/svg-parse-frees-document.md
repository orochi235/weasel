---
"@weasel-js/svg": patch
---

`parseSvg` releases the document it parsed, so thousands of calls under jsdom no longer run out of memory.

<!-- entry: fix perf -->
