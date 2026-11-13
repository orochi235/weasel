---
'@weasel-js/core': major
---

Three layer factories take the `create*Layer` name core's others have: `createPagesLayer`, `createWorkspaceTintLayer`, `createModeDecorationLayer`.

They were `pagesLayer`, `workspaceTintLayer` and `modeDecorationLayer`.

```ts
// before
const paper = pagesLayer(pages, { fill: '#fff' });
// after
const paper = createPagesLayer(pages, { fill: '#fff' });
```

<!-- entry: breaking api -->
