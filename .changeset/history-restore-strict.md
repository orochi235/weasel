---
'@weasel-js/history': major
'@weasel-js/core': major
---

`History.restore` refuses a snapshot naming an op it cannot rebuild, and returns a report of what it restored.

This is a breaking change. A strict restore, the default, throws `HistoryRestoreError`, whose `report.unresolved` lists each op with its entry and reason, and leaves the history as it was. `{ recovery: 'best-effort' }` puts a placeholder that changes nothing in each such op's place, as every restore did before, lists them in the returned report, and calls `onSkip` each time an undo or redo steps past one. A `rebuildOp` hook is now passed a third argument naming the op's entry and the recovery, and may answer `{ unresolved: reason }`.

```ts
// before
history.restore(saved);
// after: strict, or keep what can be kept
try {
  history.restore(saved);
} catch (err) {
  if (!(err instanceof HistoryRestoreError)) throw err;
  const { unresolved } = history.restore(saved, { recovery: 'best-effort', onSkip: log });
}
```

<!-- entry: rank=10 breaking api behavior -->
