---
'@weasel-js/core': minor
---

`scene.replay(ops)` applies the ops another scene's `history.observe` reported, undo and redo included, without recording them.

Each op is a `{ name, args }` pair, as `step.entries[i].applied` gives them; they rebuild as `restoreHistory` rebuilds a snapshot's, so a kind taught with `registerOp` has to be registered on both scenes. The receiving history stays as it was and its `observe` hears nothing, so every step it reports is a local edit and a sync layer can forward all of them without echoing back what it received. An op that does not fit the receiving scene throws, after taking back the ops before it.

```ts
a.history.observe((step) => {
  b.replay(step.entries.flatMap((e) => e.applied).map((op) => ({ name: op.name!, args: op.args })));
});
```

<!-- entry: rank=10 new api -->
