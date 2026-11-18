---
'@weasel-js/diagram': major
---

The effect editor's rename-cluster action is `diagram.renameCluster`, under the `diagram.` prefix every other diagram action id uses.

A binding or keymap naming `'effect.renameGroup'` uses `'diagram.renameCluster'`; its params are unchanged.

```ts
// before
bindings: [{ spec: { kind: 'doubleClick' }, actionId: 'effect.renameGroup' }],
// after
bindings: [{ spec: { kind: 'doubleClick' }, actionId: 'diagram.renameCluster' }],
```

<!-- entry: breaking api -->
