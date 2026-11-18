---
'@weasel-js/kernel3d': major
---

kernel3d's dep factories are `createNodeAtPoint3dDep`, `createAreaSelect3dDep`, `createSnap3dDep` and `createInsert3dDep`.

`createNodeAtPoint`, `createAreaSelect`, `createSnap` and `createInsert` are renamed so each says it builds a 3D dep; their arguments are unchanged.

```ts
// before
const deps = { nodeAtPoint: createNodeAtPoint(world), snap: () => createSnap(world, { sources }) };
// after
const deps = { nodeAtPoint: createNodeAtPoint3dDep(world), snap: () => createSnap3dDep(world, { sources }) };
```

<!-- entry: breaking api -->
