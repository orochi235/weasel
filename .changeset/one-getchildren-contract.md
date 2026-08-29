---
'@weasel-js/core': patch
---

`getChildren` means one thing on an adapter

`MoveAdapter` declared `getChildren(id)` — a node's direct children, for the
drag cascade — and `OrderedAdapter` declared `getChildren(parentId | null)`,
the z-ordering seam where `null` means the root. Both land on the same adapter
object, so `arrayAdapter` took the first shape from its config and exposed it
under the name the ops read with the second meaning. An op asking for root
order got `[]`, which reads as "the root has no siblings", and the slot it
captured was silently lost.

The two declarations are now one contract, and `arrayAdapter` answers the root
from its own item array rather than delegating — a consumer callback written
for node ids returns `[]` there, which cannot be told apart from a genuine
empty answer. A consumer's `getChildren` config is still only ever asked about
a node id.

`arrayAdapter` still exposes no `setChildOrder`, so it places by ordinal rather
than by anchor. That is unchanged, and it is why the ordinal fallback exists.
