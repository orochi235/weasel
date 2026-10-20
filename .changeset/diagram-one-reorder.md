---
"@weasel-js/diagram": patch
---

One reorder drag: `createReorderAction` carries an item of any drawn sequence and takes a `show`
option, `'bar'` (the default) for an insertion bar or `'slide'` to slide the other items into place.
`DiagramView`'s `onReorder` is now built on it through `groupReorderSlots`, and the pipeline editor's
stage and lane reorders use it too; `onReorder` behaves as before.

Breaking: `createSlotReorderAction`, `slotReorderContribution`, `slotReorderBinding`,
`SLOT_REORDER_ACTION_ID`, and `reorderBindings` are gone. Use `createReorderAction`,
`reorderContribution`, `reorderBinding`, and `REORDER_ACTION_ID` (`'diagram.reorder'`), whose
`slots` now also hears the press point. `createReorderAction` no longer takes a report callback;
`groupReorderContribution(report)` is what `onReorder` installs. A move's `commit` hears `order`
beside `id`, `from`, and `to`, and an item lands in the gap nearest its middle rather than the
pointer.
