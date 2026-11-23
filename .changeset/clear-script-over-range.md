---
'@weasel-js/text': minor
---

`clearScriptOverRange(runs, style, start, end)` takes `script` off a range of text whose node sets one.

A run has no value for "no script", so the node's `script` is cleared and set on every run outside the range that carries none of its own, as `setFlagOverRange` does for a flag.

<!-- entry: api -->
