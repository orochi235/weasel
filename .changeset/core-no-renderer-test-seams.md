---
'@weasel-js/core': patch
---

Loading `@weasel-js/core` no longer loads `@weasel-js/renderer/test-seams`, so test-only resets stay out of an app's module graph.

<!-- entry: fix perf -->
