---
'@weasel-js/core': major
---

`useKeybindings` takes `enabled` in place of `disable`, as the dispatcher, snap and hover-tracking hooks do.

```ts
// before
useKeybindings(tools, { disable: true });
// after
useKeybindings(tools, { enabled: false });
```

<!-- entry: breaking api -->
