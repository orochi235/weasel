---
"@weasel-js/icons": patch
---

The icon registry no longer notifies subscribers when `add` gets an empty list or `provideVariants` names only variants it already knows. `entries()` keeps its array, and a `useSyncExternalStore` reader does not re-render.

<!-- entry: rank=-5 fix perf -->
