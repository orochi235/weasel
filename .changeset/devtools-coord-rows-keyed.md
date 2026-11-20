---
"@weasel-js/devtools": patch
---

The Dispatch tab's coord table keeps its rows mounted as new records arrive, rather than rebuilding all of them on every read once it holds more than a hundred.

<!-- entry: fix perf -->
