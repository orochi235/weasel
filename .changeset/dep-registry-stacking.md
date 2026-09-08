---
'@weasel-js/core': patch
---

Two canvases under one `DepRegistryProvider` no longer take each other's deps
down.

`register` set one source per name and its release did a bare `delete`. Mount a
second canvas under a shared provider and it displaced the first's `view` /
`scene` / `selection`; unmount either one and the name went dark for the canvas
still on screen.

Sources now stack per name, newest live, and a release removes its own entry
wherever it sits — so a displaced source comes back when the one above it
leaves, and a displaced source leaving disturbs nothing. Same shape as the
`ActionsProvider` registrant stack, one layer down.
