---
'@weasel-js/diagram': major
---

The effect editor's rename-group action is `diagram.renameGroup`, under the `diagram.` prefix every other diagram action id uses.

A binding or keymap naming `'effect.renameGroup'` uses `'diagram.renameGroup'`; its params are unchanged.

```ts
// before
bindings: [{ spec: { kind: 'doubleClick' }, actionId: 'effect.renameGroup' }],
// after
bindings: [{ spec: { kind: 'doubleClick' }, actionId: 'diagram.renameGroup' }],
```

<!-- entry: breaking api -->
