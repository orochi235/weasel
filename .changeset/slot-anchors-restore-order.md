---
'@weasel-js/core': patch
---

Undoing a multi-node delete or group restores document order

Restoring by stored index cannot survive replay: history runs a batch's
inverses in reverse, while indices captured before the mutation are only
correct in ascending order. Deleting `b, c, d` from `[a, b, c, d, e]` and
undoing gave `a, b, e, c, d`; Cmd+G on the same three did the same.

Ops now record a `Slot` — an ordinal plus the id of the following sibling at
capture. The anchor is the source of truth whenever it resolves, and it
resolves whatever else the batch has already restored. The ordinal remains as
the fallback for an adapter that can place by index but cannot enumerate
children. `before: null` means "last" and needs no sibling list; an absent
`before` means "unobserved", and the two survive `History.serialize` because
`undefined` drops out of JSON and `null` does not.

The ops observe their own slot during `apply()` rather than taking one from the
caller, so every existing emitter gets this without a call-site change.
`createDeleteOp`'s `index` argument is now a seed that `apply` supersedes; its
docstring said it was sufficient on its own, which it never was.

Adapters without an ordering seam still append, as they did before:
`arrayAdapter` has no `setChildOrder`, and the move gesture's adapter has
neither that nor an `index` parameter on `insertNode`.
