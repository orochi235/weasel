---
'@weasel-js/path-tools': major
---

`joinPathsCommand` is `createJoinPathsAction`: it builds an action, and "command" in path-tools means a draw command.

```ts
// before
const join = joinPathsCommand({ id: 'join', label: 'Join' }, () => ({}));
// after
const join = createJoinPathsAction({ id: 'join', label: 'Join' }, () => ({}));
```

<!-- entry: breaking api -->
