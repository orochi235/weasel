---
"@weasel-js/diagram": patch
---

The obstacle-avoiding router retries a connector with no path only when something it depends on changes, rather than on every update. A connector that a label's interim spot blocked is routed in the same update.

<!-- entry: perf fix -->
