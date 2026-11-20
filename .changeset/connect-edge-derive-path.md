---
'@weasel-js/diagram': minor
---

The connect action and connector tool take `edgeDerivePath`, so an edge drawn with custom `routers` or a `frame` keeps its preview's shape.

Without one, development warns when `routers` or `frame` is set and `commit` is not.

```ts
const derivePath = edgeDerivePath({ routers }); // registered in the scene's registry
createConnectorTool({ participants, routers, router: 'wavy', edgeDerivePath: derivePath });
```

<!-- entry: api fix -->
