---
'@weasel-js/core': patch
---

Undo restores z-order, and reorder ops survive a reload

Two defects in the op layer, found reviewing `core/ops` and `core/adapters`.

`createDeleteOp` captures the node's z-index and forwards it through
`invert()` so undo puts the node back where it was — but `SceneAdapter`
declared `insertNode(node)` with no index parameter, so the only
implementation that honored it was the one that had gone off-contract to
accept it. `arrayAdapter` appended unconditionally and `animateLifecycle`
dropped the argument while wrapping. Deleting a node and undoing therefore
moved it to the top of the paint order, and undoing a multi-delete reversed
the stack. The parameter is now part of the interface and both
implementations honor it.

`createReorderOp` — bring forward, send backward, bring to front, send to
back — built an op with no `name` and registered no factory, though `Op`'s
contract says kit-emitted ops always carry one. `History.serialize()` drops
any entry holding a nameless op, so all four silently vanished from the
persisted undo stack on reload while `moveToIndex`, which does register,
survived. They now serialize, with the per-parent before-order carried in
the op's args so a rebuilt op can still invert.
