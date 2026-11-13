---
'@weasel-js/path-tools': major
---

The Girth drag's grab reach is `reachPx`, in its params and in `useGirthTool`'s options, as every other screen-px param is named.

```ts
// before
useGirthTool({ reach: 10 });
registry.trigger('girth.drag', { reach: 10 });
// after
useGirthTool({ reachPx: 10 });
registry.trigger('girth.drag', { reachPx: 10 });
```

<!-- entry: breaking -->
