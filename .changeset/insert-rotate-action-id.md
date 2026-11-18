---
'@weasel-js/core': major
'@weasel-js/editing': major
---

The insert gesture's wheel-rotate action has the id `insert.rotate`, matching `insertRotateAction` and its sibling `insert.reposition`.

```ts
// before
{ spec: { kind: 'wheel', phase: 'engaged', mods: { shift: true } }, actionId: 'insert.adjustRotation' }
// after
{ spec: { kind: 'wheel', phase: 'engaged', mods: { shift: true } }, actionId: 'insert.rotate' }
```

<!-- entry: breaking api -->
