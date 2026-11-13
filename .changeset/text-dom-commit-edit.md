---
'@weasel-js/text-dom': major
'@weasel-js/core': major
---

`useTextEdit` and `useSceneTextEdit` return `commitEdit` where they returned `commit`, beside `startEdit` and `cancelEdit`; the `commit` option, which receives the edit, keeps its name.

```ts
// before
edit.commit();
// after
edit.commitEdit();
```

<!-- entry: breaking -->
