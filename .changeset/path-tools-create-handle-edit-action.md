---
'@weasel-js/path-tools': major
---

`createHandleCommand` is `createHandleEditAction`: it builds an action that edits handles.

```ts
// before
const smooth = createHandleCommand('smoothHandles', 'Smooth', icon, edit);
// after
const smooth = createHandleEditAction('smoothHandles', 'Smooth', icon, edit);
```

<!-- entry: breaking api -->
