---
'@weasel-js/core': patch
---

Undoing a removal from a persisted history brings `derivePath` and
`clipFromPose` back.

`kit:remove`'s snapshot cloned each node with its function-valued fields
attached, which works in-session and disappears the moment the history is
serialized. `dependsOn` survived the round-trip and repopulated the dependency
index, so a restored derived node looked wired up and never painted; a
container came back unclipped the same way.

The snapshot now carries the registry keys beside the nodes, and revert
re-resolves them exactly as `kit:add` does — warning, not throwing, when a key
is absent from the scene's registry.
