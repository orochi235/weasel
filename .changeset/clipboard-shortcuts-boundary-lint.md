---
"@weasel-js/core": minor
---

Clipboard keyboard actions, and two bugs the wiring flushed out.

`clipboard.copy` (Cmd/Ctrl+C) and `clipboard.cut` (Cmd/Ctrl+X) are kit-standard
descriptors. Publish the imperative surface `useClipboardOps` returns as the new
`clipboard` dep and both work; the buttons a consumer already has and the
shortcut then route through one implementation instead of two. Cut is copy plus
the same batched delete `deleteAction` performs — one undo entry.

There is deliberately no `clipboard.paste`. Cmd/Ctrl+V already arrives as a DOM
`paste` event, which the dispatcher routes to `ingest` and the content-handler
registry — the path that reaches the OS payload. A key binding would fire
alongside it and paste twice.

Two older bugs, both found by actually pressing the keys:

- **Deleting a container together with its children threw mid-batch.**
  `removeNode` cascades the subtree, so a group's op already takes its members
  with it and the members' own ops then hit `unknown node id`. Selecting a group
  and its contents at once — what Cmd+A does — was enough. `deleteAction` and
  `clipboard.cut` now share one op builder that skips any id with a selected
  ancestor.
- **Cmd+D did nothing at all.** Two faults stacked. `duplicate` threw before
  its `enabled` gate could answer, because the gate reads `deps.selection` and
  the descriptor never declared it — an undeclared read the dev-build deps
  Proxy treats as an error. Declared now, with a sweep test over every
  `requiresSelection`-gated descriptor so the next one can't ship the same way.
  And underneath that, the invoker was a stub whose body was `void params`,
  deferring to a "legacy bridge" that no longer exists. `duplicateAction` now
  really duplicates: each selected node with its whole subtree (so a duplicated
  group comes out populated, not empty), offset by the same 12 units a paste
  gets, as one undoable batch, with the copies selected afterward. Descendants
  are offset only for absolute-pose scenes — with a `poseComposition`
  registered, poses are relative and moving the root already carries them.

`polygonHitTestRect` moved from `features/paths/` to `core/geometry/`: it is
pure geometry, `core/adapters/arrayAdapter.ts` needs it, and core may not import
from features. Same exports from the package barrel.
