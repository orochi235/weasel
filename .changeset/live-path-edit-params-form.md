---
'@weasel-js/core': major
---

`livePathEdit` takes its params as a form, `params`, in place of `initial`, and a commit made with it is the last operation.

The driving param's default is its leaf's default, and the last-operation panel shows the form after a commit, replaying it from the paths as the gesture found them.

```ts
// before
livePathEdit({ id: 'inset', label: 'Inset', param: 'distance', initial: 2, edit, commit });
// after
livePathEdit({
  id: 'inset', label: 'Inset', param: 'distance',
  params: pref.group('Inset', { distance: pref.number('Distance', 2, { min: 0, max: 50 }) }),
  edit, commit,
});
```

<!-- entry: breaking api -->
