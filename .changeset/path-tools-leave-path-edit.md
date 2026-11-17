---
'@weasel-js/path-tools': major
---

The action that leaves path edit is `leavePathEdit`, the verb `group.leave` uses for leaving a group.

Its label is "Leave path edit" and its Escape binding's id is `leavePathEdit.key`.

```ts
// before
actions.trigger('exitPathEdit');
// after
actions.trigger('leavePathEdit');
```

<!-- entry: breaking api -->
