---
'@weasel-js/labkit': patch
---

Fixes to what a labkit trial's undo records, and to saving its marks.

- A config write records one undo entry when the instrument snapshots on both `config.change` and `config.change:<path>`. It recorded two, so the first Undo appeared to do nothing.
- Undoing a run of writes to one setting ends that run, so the next write to it within half a second is its own undo step. Before, with an instrument history mounted through `useTrialHistory` (as `<TrialSceneCanvas>` does), that write was folded into the entry just undone and could not be undone.
- A write to a setting of the schema a config is drawn over (`f.schema(nodes, { over })`, an `f.alias` row) is recorded on the trial's undo history, so Undo and Redo step it like any other setting.
- A palette drop is taken back by one Undo under the default `undo`, which never recorded it, and under `undo: { snapshotOn: ['canvas.itemAdded'] }`, which recorded it twice. `useDragDrop` now emits `'canvas.itemAdded'` before it applies the drop rather than after, so a snapshot taken on the event holds the state from before the drop.
- A trial's marks are saved when the page hides. A mark made less than a quarter second before a reload or a closed tab used to be lost.
