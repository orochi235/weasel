---
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

A node's kind has one answer: its routing kind. `<SceneCanvas>` now publishes each selected node's
routing kind with the selection, so the command palette says "3 rects selected" or "2 groups
selected"; a node its routing table calls `'unknown'` publishes no kind, and the palette says
"objects". Before, the default label read `'group'` for a container, `'path'` for a pose carrying a
`kind`, and nothing for anything else. `describeKind` still replaces the label outright.

`SelectionPanel`'s `classifyKind` classifies through the new `routeKind` export, the function behind
`NodeRouting.classify`, and hands each routing entry the node beside its data. It no longer calls a
container `'group'` on its own: pass a table carrying `groupNodeRouting`, as `inferredNodeRouting`
does, for that. This changes behavior for a panel given a table without it, such as
`defaultNodeRouting` alone.
