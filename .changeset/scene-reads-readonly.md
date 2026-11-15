---
'@weasel-js/core': major
---

Scene nodes and layer records are typed readonly: what `scene.get(id)`, `scene.nodes` and `scene.layers` hand out is read, never written.

They are live views of the scene's own records, not copies. Change a node through the scene's edits, which record history and notify:

```ts
// before: compiled, skipped history and notifications, and left the scene's version alone
scene.get(id)!.pose.x = 10;
// after
scene.setPose(id, { ...scene.get(id)!.pose, x: 10 });
```

`MutableNode` is kit-internal and not exported.

<!-- entry: rank=10 breaking api -->
