---
'@weasel-js/devtools': major
---

A `get-history` request asks for the stacks' entries with `historyEntries`, and the slice returns them under that name; both were `checkpoints`.

The panel's switch reads "entries".

```ts
// before
client.request(rootId, { type: 'get-history', cursor, checkpoints: true });
// after
client.request(rootId, { type: 'get-history', cursor, historyEntries: true });
```

<!-- entry: breaking api -->
