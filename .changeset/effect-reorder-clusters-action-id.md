---
'@weasel-js/diagram': major
---

The effect editor's action that drags a cluster by its title is `diagram.reorderClusters`.

It was `diagram.reorderGroups`; a binding or keymap naming it uses the new id, with the same params.

```ts
// before
bindings: [{ spec: { kind: 'drag' }, actionId: 'diagram.reorderGroups' }],
// after
bindings: [{ spec: { kind: 'drag' }, actionId: 'diagram.reorderClusters' }],
```

<!-- entry: breaking api -->
