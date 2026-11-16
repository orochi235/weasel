---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

Core and routing depend on `@weasel-js/pref-schema` instead of `@weasel-js/prefs`, so they no longer install the prefs store or storage

Neither imported the store; they declare action params, tool options and node properties with the schema alone. An app that opens a prefs store still lists `@weasel-js/prefs` itself.

<!-- entry: perf -->
