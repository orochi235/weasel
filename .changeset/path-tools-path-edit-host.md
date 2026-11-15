---
'@weasel-js/path-tools': minor
---

`createPathEditHost()` holds which path is open and which anchors are selected, for `<SceneCanvas pathEdit>`, `redrawOn`, and a panel to read.

```ts
const host = createPathEditHost({ id: 'outline', anchors: [2] });
<SceneCanvas pathEdit={host} redrawOn={[host]} … />
```

Given `{ modes }`, path edit is a mode: opening a path enters `'path-edit'`, closing it returns to `'normal'` (`mode` and `exitMode` rename them), and a path counts as open only while the registry is in that mode.

<!-- entry: api -->
