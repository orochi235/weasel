---
'@weasel-js/forge': patch
---

An isolated story with a `viewport` no longer loads its frame twice when first opened. Its trial's stage came only from the frame's `ready`, so the trial moved the frame into a stage once the story reported and the iframe reloaded. The index now reads a native story's `viewport` when both sides are number literals (`IndexEntry.viewport`), and the trial starts with that stage; a viewport the index cannot read still costs one reload.
