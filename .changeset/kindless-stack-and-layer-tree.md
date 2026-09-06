---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Let a `LayerStack` have no palette, and let a `LayerList` nest.

**`LayerStack`** required `kind` on every item plus `paletteKinds` and `onAdd`
on the stack, so a list whose items have no kind and nowhere to add from had to
pass three stubs to get a drag-reorderable set of expandable cards. All three
are optional now, as are `onRemove` and `onPrimaryChange`:

- An item names itself with `label` when it has no `kind`.
- The head row renders only when there is a title or a palette to put in it.
  Without `onAdd` there is no palette, whatever `paletteKinds` says.
- No `onRemove`, no ✕. No `onPrimaryChange`, no select — a `primaryValue` with
  no handler would have been a control the user could not change.
- The empty state stops pointing at a palette that is not there, and
  `emptyLabel` overrides it.

**`LayerList`** took a flat array, so a nested set of layers had to be
rebuilt as a recursive component outside the kit. `layers` is now
`LayerTreeNode[]` — a `LayerDescriptor` with optional `children` — and a node
with children renders an expandable subtree behind `<Disclosure>`. A plain
`LayerDescriptor[]` still type-checks and renders exactly as before, twisty
column included: it appears only once some node in the tree has children.

Reordering is scoped to siblings. A drag moves a row within its own parent's
child list and never reparents it; `onReorder` still hands back the whole tree,
with only that group's order changed. Collapse is uncontrolled by default,
seeded from each node's `defaultCollapsed`; pass `collapsedIds` to own it, and
`onCollapsedChange` fires either way.
