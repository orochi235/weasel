---
'@weasel-js/core': patch
---

core: the canvas adapter (`sceneToAdapter`), `defaultCommitAdapter`, and the adapter the move action hands its behaviors now share one set of scene mutators, so an op applies the same way through all three. Not breaking. What that changes:

- `sceneToAdapter` has `setLayer`. A `setLayer` op applied through it, such as the one a cross-layer reparent-on-drop sends to a consumer's `applyOps`, used to throw.
- `defaultCommitAdapter().setChildOrder` called outside a batch records one undo step instead of one per sibling it moved.
- A move behavior that answers with a delete op now gets the node's dependents back on undo, as rotate's already did. A `setLayout` or `setSelection` op from a move behavior applies instead of throwing.
