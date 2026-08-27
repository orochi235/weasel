---
'@weasel-js/ui': patch
---

A property renderer can read the rest of the node, not just its own leaf

`PropertyRenderContext` carried one leaf's aggregated value, so a control whose
subject spans several fields had no way to see the others. `valueAt(path)`
returns the same `{ value, mixed }` aggregation for any node path across the
same selection: a value when every selected node agrees, `mixed` when they
don't, and an undefined value when nothing carries the path.

WeaselDraw's font picker is the case that asked for it. Its substitution label
names the variant a family will actually paint in, and it was probing at a
nominal 400/normal because the node's own `fontWeight` and `fontStyle` were out
of reach; it now probes at the node's real ones.
