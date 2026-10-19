---
"@weasel-js/devtools": patch
"@weasel-js/core": patch
---

The devtools panel gains a Registry tab, listing a canvas's tools, actions and deps under a name
filter, each opening to its details and its bindings drawn in the route grammar, and a History tab,
following the scene's history steps with each entry's ops, where the history stands with whether it
can undo or redo, and the checkpoint stack on request. `followHistory` reads `get-history` through
its cursor without React.

A scene gains `getContentVersion()`, which moves on every change but one that only changed the
selection. The devtools hook uses it, so a selection change is no longer also announced as a
`scene` change.
