---
"@weasel-js/core": patch
"@weasel-js/history": patch
"@weasel-js/routing": patch
---

The devtools hook serves two more requests, still under protocol 1. `get-registry` describes what a
canvas has registered: its tools and preset contributions with their bindings, its actions, the dep
names its registry answers, and its node routing kinds. `get-history` hands back the scene's history
steps since a cursor — each push, merge, undo, redo or jump, with the ops it carried and where the
history stood — from a rolling buffer of 200 that records in dev builds and in production while a
panel is connected. `changed` reports both as the new `registry` and `history` areas. See
`docs/devtools.md`.

`History` gains `observe(listener)`, which hears what each change to the stacks was, and
`touchedIdsFromOps` is exported from `@weasel-js/history`. A hand-written `History` implementation
must add `observe`. `DepRegistry` gains an optional `list()` naming every dep it answers.
