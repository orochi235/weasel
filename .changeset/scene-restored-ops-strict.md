---
'@weasel-js/core': major
---

A restored op that fails on undo or redo throws `RestoredOpError` and leaves its entry, and the scene, where they were.

This is a breaking change. Before, such an op was skipped and the entry moved on. `scene.restoreHistory` is strict too: it throws `HistoryRestoreError` for an op it cannot rebuild, for an `applyBatch` op while no history adapter is set, and for a snapshot in another recorded form, so call `setHistoryAdapter` before restoring. It returns the restore's report, and `{ recovery: 'best-effort' }` keeps what it can, as `History.restore` does. See "Restoring history" in `docs/scene-serialization.md`.

```ts
// before
scene.restoreHistory(saved);
scene.setHistoryAdapter(() => adapter);
// after
scene.setHistoryAdapter(() => adapter);
const report = scene.restoreHistory(saved, { recovery: 'best-effort', onSkip: log });
```

<!-- entry: rank=10 breaking behavior -->
