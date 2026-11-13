---
'@weasel-js/core': major
---

`pagesLayer`, `workspaceTintLayer` and `modeDecorationLayer` are renamed `createPagesLayer`, `createWorkspaceTintLayer` and `createModeDecorationLayer`, as core's other layer factories are named.

```ts
// before
const paper = pagesLayer(pages, { fill: '#fff' });
// after
const paper = createPagesLayer(pages, { fill: '#fff' });
```

<!-- entry: breaking api -->
