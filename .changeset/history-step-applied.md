---
'@weasel-js/history': minor
---

Each entry `History.observe` reports carries `applied`: the ops that step applied for it, an undo's inverses included.

Applying them in order to a copy of the state the step started from makes the same change: a push's or a coalesce's ops, a redo's forward ops, an undo's inverses newest first, and nothing for a step that only moved the stacks (`prune`, `drop`, `branch`, `clear`, `restore`). `ops` stays the entry's forward ops.

```ts
history.observe((step) => {
  send(step.entries.flatMap((e) => e.applied).map((op) => ({ name: op.name!, args: op.args })));
});
```

<!-- entry: rank=5 api -->
